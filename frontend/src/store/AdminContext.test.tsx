import { afterEach, describe, expect, it } from "vitest"
import { act, cleanup, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { AdminProvider } from "./AdminContext"
import { ADMIN_GRANT_KEY, useAdmin } from "./admin-context"

afterEach(() => {
  cleanup()
  sessionStorage.clear()
})

const wrapper = ({ children }: { children: ReactNode }) => (
  <AdminProvider>{children}</AdminProvider>
)

describe("useAdmin (session-scoped grant)", () => {
  it("starts denied when no session grant exists", () => {
    sessionStorage.removeItem(ADMIN_GRANT_KEY)
    const { result } = renderHook(() => useAdmin(), { wrapper })
    expect(result.current.granted).toBe(false)
  })

  it("login grants access and persists the grant in sessionStorage", () => {
    const { result } = renderHook(() => useAdmin(), { wrapper })
    act(() => result.current.login())
    expect(result.current.granted).toBe(true)
    expect(sessionStorage.getItem(ADMIN_GRANT_KEY)).toBe("1")
  })

  it("restores the grant on mount when sessionStorage already holds it", () => {
    sessionStorage.setItem(ADMIN_GRANT_KEY, "1")
    const { result } = renderHook(() => useAdmin(), { wrapper })
    expect(result.current.granted).toBe(true)
  })

  it("logout revokes the grant and clears sessionStorage", () => {
    sessionStorage.setItem(ADMIN_GRANT_KEY, "1")
    const { result } = renderHook(() => useAdmin(), { wrapper })
    act(() => result.current.logout())
    expect(result.current.granted).toBe(false)
    expect(sessionStorage.getItem(ADMIN_GRANT_KEY)).toBeNull()
  })

  it("is session-scoped: a new session (cleared storage) starts denied again", () => {
    sessionStorage.setItem(ADMIN_GRANT_KEY, "1")
    const first = renderHook(() => useAdmin(), { wrapper })
    expect(first.result.current.granted).toBe(true)
    first.unmount()
    sessionStorage.clear()
    const second = renderHook(() => useAdmin(), { wrapper })
    expect(second.result.current.granted).toBe(false)
  })
})