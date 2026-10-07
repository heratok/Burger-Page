import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { AuthProvider, useAuth } from "./AuthContext"

const SESSION_KEY = "burger_page_session_v2"
const TOKEN_KEY = "burger_page_auth_token_v2"

function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "none" }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.signature`
}

describe("AuthContext session restore", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it("restores a current-format session from sessionStorage as-is", () => {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ role: "super_admin", userId: "usr-1", username: "ana" })
    )

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

    expect(result.current.session).toMatchObject({
      role: "super_admin",
      userId: "usr-1",
      username: "ana",
    })
  })

  it("falls back to the legacy admin_session localStorage key when no v2 session is stored", () => {
    // Pre-v2 sessions were written under this key; a user with one cached
    // locally must not be silently logged out on deploy (UsersDirectory's
    // own-row tests rely on this same fallback).
    localStorage.setItem(
      "admin_session",
      JSON.stringify({ role: "super_admin", userId: "usr-legacy", username: "legacy_admin" })
    )

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

    expect(result.current.session).toMatchObject({
      role: "super_admin",
      userId: "usr-legacy",
      username: "legacy_admin",
    })
  })

  it("backfills userId/username by decoding the stored JWT when a restored session is missing them", () => {
    // A session shape from an even older migration: identity lives only in
    // the token, not in the persisted session JSON.
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ role: "super_admin" }))
    sessionStorage.setItem(TOKEN_KEY, makeJwt({ userId: "usr-from-jwt", username: "from_jwt" }))

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

    expect(result.current.session).toMatchObject({
      role: "super_admin",
      userId: "usr-from-jwt",
      username: "from_jwt",
    })
  })

  it("does not overwrite a userId/username already present in the restored session with the JWT's", () => {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ role: "super_admin", userId: "usr-real", username: "real_user" })
    )
    sessionStorage.setItem(TOKEN_KEY, makeJwt({ userId: "usr-from-jwt", username: "from_jwt" }))

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

    expect(result.current.session).toMatchObject({ userId: "usr-real", username: "real_user" })
  })
})

describe("AuthContext RBAC - permissions and can() helper", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it("grants all permissions to super admin via can()", () => {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ role: "super", userId: "usr-super", username: "superman" })
    )

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

    expect(result.current.can("orders.view")).toBe(true)
    expect(result.current.can("finance.view")).toBe(true)
    expect(result.current.can("roles.manage")).toBe(true)
    expect(result.current.permissions.length).toBeGreaterThanOrEqual(12)
  })

  it("grants all permissions to restaurant admin via can()", () => {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ role: "restaurant", restaurantId: "rest-1", userId: "usr-admin", username: "boss" })
    )

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

    expect(result.current.can("orders.view")).toBe(true)
    expect(result.current.can("finance.view")).toBe(true)
    expect(result.current.can("users.manage")).toBe(true)
    expect(result.current.permissions.length).toBeGreaterThanOrEqual(12)
  })

  it("gates permissions strictly for restaurant_staff according to session.permissions", () => {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        role: "staff",
        restaurantId: "rest-1",
        userId: "usr-staff",
        username: "chef",
        roleId: "role-cook",
        permissions: ["orders.view", "orders.manage"],
      })
    )

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

    expect(result.current.can("orders.view")).toBe(true)
    expect(result.current.can("orders.manage")).toBe(true)
    expect(result.current.can("finance.view")).toBe(false)
    expect(result.current.can("roles.manage")).toBe(false)
    expect(result.current.can("users.manage")).toBe(false)
    expect(result.current.permissions).toEqual(["orders.view", "orders.manage"])
  })

  it("maps restaurant_staff role to 'staff' and preserves permissions on login", async () => {
    const { apiClient } = await import("@/core/api/apiClient")
    vi.spyOn(apiClient, "login").mockResolvedValueOnce({
      success: true,
      token: "tok-staff",
      user: {
        id: "usr-1",
        username: "mesero",
        role: "restaurant_staff",
        restaurantId: "rest-1",
        roleId: "role-waiter",
        permissions: ["orders.view", "tables.manage"],
        mustChangePassword: false,
      },
    })

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

    let loginRes: any
    await act(async () => {
      loginRes = await result.current.login("mesero", "password123")
    })
    expect(loginRes.success).toBe(true)
    expect(loginRes.role).toBe("staff")
    expect(result.current.session.role).toBe("staff")
    expect(result.current.session.permissions).toEqual(["orders.view", "tables.manage"])
    expect(result.current.can("orders.view")).toBe(true)
    expect(result.current.can("tables.manage")).toBe(true)
    expect(result.current.can("finance.view")).toBe(false)
  })
})

describe("AuthContext forced password change", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  const seedForcedSession = () =>
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ role: "staff", userId: "usr-1", username: "mesero", mustChangePassword: true })
    )

  const renderWithCallback = (onPasswordChanged: () => void) =>
    renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider onPasswordChanged={onPasswordChanged}>{children}</AuthProvider>,
    })

  it("notifies onPasswordChanged after a successful change so session-scoped data is re-read with the fresh token", async () => {
    const { apiClient } = await import("@/core/api/apiClient")
    seedForcedSession()
    vi.spyOn(apiClient, "changeOwnPassword").mockResolvedValue({ success: true, token: "fresh-token" })
    const onPasswordChanged = vi.fn()
    const { result } = renderWithCallback(onPasswordChanged)

    await act(async () => {
      await result.current.changePassword("temp-pass", "new-secret-1")
    })

    expect(result.current.session.mustChangePassword).toBe(false)
    expect(onPasswordChanged).toHaveBeenCalledTimes(1)
  })

  it("does not notify onPasswordChanged when the change is rejected", async () => {
    const { apiClient } = await import("@/core/api/apiClient")
    seedForcedSession()
    vi.spyOn(apiClient, "changeOwnPassword").mockResolvedValue({ success: false } as any)
    const onPasswordChanged = vi.fn()
    const { result } = renderWithCallback(onPasswordChanged)

    await act(async () => {
      await result.current.changePassword("temp-pass", "new-secret-1")
    })

    expect(onPasswordChanged).not.toHaveBeenCalled()
  })
})


