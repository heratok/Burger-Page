import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { useStoreStatusRefresh } from "./useStoreStatusRefresh"

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: state })
  document.dispatchEvent(new Event("visibilitychange"))
}

describe("useStoreStatusRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("refreshes every 60 seconds while the tab is visible", () => {
    const refresh = vi.fn()
    renderHook(() => useStoreStatusRefresh(refresh))
    expect(refresh).not.toHaveBeenCalled()
    vi.advanceTimersByTime(60_000)
    expect(refresh).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(120_000)
    expect(refresh).toHaveBeenCalledTimes(3)
  })

  it("stops polling while hidden and refreshes immediately when visible again", () => {
    const refresh = vi.fn()
    renderHook(() => useStoreStatusRefresh(refresh))
    setVisibility("hidden")
    vi.advanceTimersByTime(300_000)
    expect(refresh).not.toHaveBeenCalled()
    setVisibility("visible")
    expect(refresh).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(60_000)
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it("does not start a timer when mounted hidden", () => {
    setVisibility("hidden")
    const refresh = vi.fn()
    renderHook(() => useStoreStatusRefresh(refresh))
    vi.advanceTimersByTime(180_000)
    expect(refresh).not.toHaveBeenCalled()
  })

  it("does not duplicate timers on repeated visibility events", () => {
    const refresh = vi.fn()
    renderHook(() => useStoreStatusRefresh(refresh))
    setVisibility("visible")
    setVisibility("visible")
    expect(refresh).toHaveBeenCalledTimes(2)
    refresh.mockClear()
    vi.advanceTimersByTime(60_000)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it("cleans up timer and listener on unmount", () => {
    const refresh = vi.fn()
    const { unmount } = renderHook(() => useStoreStatusRefresh(refresh))
    unmount()
    vi.advanceTimersByTime(180_000)
    setVisibility("visible")
    expect(refresh).not.toHaveBeenCalled()
  })

  it("uses the latest refresh callback without restarting the timer", () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(({ cb }) => useStoreStatusRefresh(cb), {
      initialProps: { cb: first },
    })
    vi.advanceTimersByTime(30_000)
    rerender({ cb: second })
    vi.advanceTimersByTime(30_000)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})
