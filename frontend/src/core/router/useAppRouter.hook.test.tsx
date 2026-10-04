import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"

const loadRestaurant = vi.fn()
const switchRestaurant = vi.fn()
const setActiveView = vi.fn()
const setAdminTab = vi.fn()

const restaurants: never[] = []
const restaurantContext = {
  restaurants,
  switchRestaurant,
  loadRestaurant,
  setActiveView,
  activeView: "landing",
  adminTab: "dashboard",
  setAdminTab,
}
vi.mock("@/context/RestaurantContext", () => ({
  useUi: () => restaurantContext,
  useTenant: () => restaurantContext,
}))

import { useAppRouter } from "./useAppRouter"

describe("useAppRouter - unknown slug resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.pushState({}, "", "/some-place")
  })

  it("loads the tenant once and never calls switchRestaurant (no second fetch)", async () => {
    loadRestaurant.mockResolvedValue("ok")
    const { result } = renderHook(() => useAppRouter())
    await waitFor(() => expect(setActiveView).toHaveBeenCalledWith("store"))
    expect(loadRestaurant).toHaveBeenCalledWith("some-place")
    expect(switchRestaurant).not.toHaveBeenCalled()
    expect(result.current.isNotFound).toBe(false)
    expect(result.current.loadError).toBe(false)
  })

  it("shows not-found when the tenant does not exist", async () => {
    loadRestaurant.mockResolvedValue("not-found")
    const { result } = renderHook(() => useAppRouter())
    await waitFor(() => expect(result.current.isNotFound).toBe(true))
    expect(result.current.loadError).toBe(false)
    expect(setActiveView).toHaveBeenCalledWith("not-found")
  })

  it("shows a retryable error state on transient failure and retry reloads", async () => {
    loadRestaurant.mockResolvedValueOnce("error").mockResolvedValueOnce("ok")
    const { result } = renderHook(() => useAppRouter())
    await waitFor(() => expect(result.current.loadError).toBe(true))
    expect(result.current.isNotFound).toBe(true)
    expect(result.current.attemptedSlug).toBe("some-place")
    expect(setActiveView).not.toHaveBeenCalledWith("store")

    await act(async () => {
      result.current.retry()
    })
    await waitFor(() => expect(setActiveView).toHaveBeenCalledWith("store"))
    expect(result.current.loadError).toBe(false)
    expect(loadRestaurant).toHaveBeenCalledTimes(2)
  })
})
