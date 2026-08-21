import { describe, it, expect, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import React from "react"
import { UiProvider, useUi } from "./UiContext"
import { AuthProvider, useAuth } from "./AuthContext"
import { SEED_RESTAURANTS } from "@/data/initialData"

describe("UiContext Slice", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <UiProvider>{children}</UiProvider>
  )

  it("toggles admin theme between light and dark", () => {
    const { result } = renderHook(() => useUi(), { wrapper })
    expect(result.current.adminTheme).toBe("dark")

    act(() => {
      result.current.toggleAdminTheme()
    })
    expect(result.current.adminTheme).toBe("light")

    act(() => {
      result.current.toggleAdminTheme()
    })
    expect(result.current.adminTheme).toBe("dark")
  })

  it("updates sound enabled setting", () => {
    const { result } = renderHook(() => useUi(), { wrapper })
    expect(result.current.soundEnabled).toBe(true)

    act(() => {
      result.current.setSoundEnabled(false)
    })
    expect(result.current.soundEnabled).toBe(false)
  })
})

describe("AuthContext Slice", () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  )

  it("rejects invalid passwords", () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    act(() => {
      const response = result.current.login("wrong-password", SEED_RESTAURANTS)
      expect(response.success).toBe(false)
    })
    expect(result.current.session.role).toBe("guest")
  })

  it("logs out and resets session to guest", () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    act(() => {
      result.current.login("admin", SEED_RESTAURANTS)
    })
    expect(result.current.session.role).toBe("super")

    act(() => {
      result.current.logout()
    })
    expect(result.current.session.role).toBe("guest")
  })
})
