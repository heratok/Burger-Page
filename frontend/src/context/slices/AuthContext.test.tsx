import { describe, it, expect, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
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
