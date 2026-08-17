import { afterEach, describe, expect, it } from "vitest"
import { act, cleanup, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { AdminProvider } from "./AdminContext"
import {
  ADMIN_GRANT_KEY_PREFIX,
  LEGACY_ADMIN_GRANT_KEY,
  SUPER_ADMIN_GRANT_KEY,
  adminGrantKey,
  sessionMatches,
  useAdmin,
} from "./admin-context"
import type { AdminSession } from "./admin-context"

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  localStorage.clear()
})

const wrapper = ({ children }: { children: ReactNode }) => (
  <AdminProvider>{children}</AdminProvider>
)

describe("useAdmin (mode-aware session, AD-1)", () => {
  it("starts with no session when no grant keys exist", () => {
    const { result } = renderHook(() => useAdmin(), { wrapper })
    expect(result.current.session).toBeNull()
  })

  it("login as super stores the super key and records a super session", () => {
    const { result } = renderHook(() => useAdmin(), { wrapper })

    act(() => result.current.login("super"))

    expect(result.current.session).toEqual({ mode: "super" })
    expect(sessionStorage.getItem(SUPER_ADMIN_GRANT_KEY)).toBe("1")
  })

  it("login as restaurant stores a scoped key and records the restaurant session", () => {
    const { result } = renderHook(() => useAdmin(), { wrapper })

    act(() => result.current.login("restaurant", "rest-pizza-roma"))

    expect(result.current.session).toEqual({
      mode: "restaurant",
      restaurantId: "rest-pizza-roma",
    })
    expect(sessionStorage.getItem(adminGrantKey("rest-pizza-roma"))).toBe("1")
    expect(sessionStorage.getItem(SUPER_ADMIN_GRANT_KEY)).toBeNull()
  })

  it("restores a super session from sessionStorage on mount (reload survival)", () => {
    sessionStorage.setItem(SUPER_ADMIN_GRANT_KEY, "1")

    const { result } = renderHook(() => useAdmin(), { wrapper })

    expect(result.current.session).toEqual({ mode: "super" })
  })

  it("restores a scoped restaurant session on mount (reload survival)", () => {
    sessionStorage.setItem(adminGrantKey("rest-sushi-tokio"), "1")

    const { result } = renderHook(() => useAdmin(), { wrapper })

    expect(result.current.session).toEqual({
      mode: "restaurant",
      restaurantId: "rest-sushi-tokio",
    })
  })

  it("login replaces the previous session (single active session)", () => {
    const { result } = renderHook(() => useAdmin(), { wrapper })

    act(() => result.current.login("restaurant", "rest-pizza-roma"))
    act(() => result.current.login("super"))

    expect(result.current.session).toEqual({ mode: "super" })
    expect(sessionStorage.getItem(adminGrantKey("rest-pizza-roma"))).toBeNull()
    expect(sessionStorage.getItem(SUPER_ADMIN_GRANT_KEY)).toBe("1")
  })

  it("switching restaurant scope invalidates the previous restaurant session", () => {
    const { result } = renderHook(() => useAdmin(), { wrapper })

    act(() => result.current.login("restaurant", "rest-pizza-roma"))
    act(() => result.current.login("restaurant", "rest-sushi-tokio"))

    expect(result.current.session).toEqual({
      mode: "restaurant",
      restaurantId: "rest-sushi-tokio",
    })
    expect(sessionStorage.getItem(adminGrantKey("rest-pizza-roma"))).toBeNull()
    expect(sessionStorage.getItem(adminGrantKey("rest-sushi-tokio"))).toBe("1")
  })

  it("logout clears the session and every grant key", () => {
    sessionStorage.setItem(SUPER_ADMIN_GRANT_KEY, "1")
    const { result } = renderHook(() => useAdmin(), { wrapper })

    act(() => result.current.logout())

    expect(result.current.session).toBeNull()
    expect(sessionStorage.getItem(SUPER_ADMIN_GRANT_KEY)).toBeNull()
    expect(sessionStorage.getItem(LEGACY_ADMIN_GRANT_KEY)).toBeNull()
  })

  it("migrates the legacy boolean grant into a restaurant session for the first restaurant", () => {
    sessionStorage.setItem(LEGACY_ADMIN_GRANT_KEY, "1")

    const { result } = renderHook(() => useAdmin(), { wrapper })

    expect(result.current.session).toEqual({
      mode: "restaurant",
      restaurantId: "rest-burger-page",
    })
  })

  it("prefers an explicit scoped key over the legacy grant", () => {
    sessionStorage.setItem(LEGACY_ADMIN_GRANT_KEY, "1")
    sessionStorage.setItem(adminGrantKey("rest-sushi-tokio"), "1")

    const { result } = renderHook(() => useAdmin(), { wrapper })

    expect(result.current.session).toEqual({
      mode: "restaurant",
      restaurantId: "rest-sushi-tokio",
    })
  })

  it("is session-scoped: a fresh session (cleared storage) starts denied again", () => {
    sessionStorage.setItem(adminGrantKey("rest-pizza-roma"), "1")
    const first = renderHook(() => useAdmin(), { wrapper })
    expect(first.result.current.session).toEqual({
      mode: "restaurant",
      restaurantId: "rest-pizza-roma",
    })
    first.unmount()
    sessionStorage.clear()
    const second = renderHook(() => useAdmin(), { wrapper })
    expect(second.result.current.session).toBeNull()
  })
})

describe("sessionMatches (AD-1 scoped grants)", () => {
  const pizza: AdminSession = { mode: "restaurant", restaurantId: "rest-pizza-roma" }
  const superSession: AdminSession = { mode: "super" }

  it("matches a restaurant session to its own restaurant only", () => {
    expect(sessionMatches(pizza, "restaurant", "rest-pizza-roma")).toBe(true)
    expect(sessionMatches(pizza, "restaurant", "rest-burger-page")).toBe(false)
    expect(sessionMatches(pizza, "restaurant", undefined)).toBe(false)
  })

  it("matches a super session only to super mode", () => {
    expect(sessionMatches(superSession, "super")).toBe(true)
    expect(sessionMatches(superSession, "restaurant", "rest-pizza-roma")).toBe(false)
  })

  it("never matches a null session", () => {
    expect(sessionMatches(null, "super")).toBe(false)
    expect(sessionMatches(null, "restaurant", "rest-pizza-roma")).toBe(false)
  })

  it("builds scoped keys with the documented prefix", () => {
    expect(adminGrantKey("rest-pizza-roma")).toBe(
      `${ADMIN_GRANT_KEY_PREFIX}rest-pizza-roma`
    )
  })
})