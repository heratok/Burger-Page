import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useStoreOpenStatus } from "./useStoreOpenStatus"
import type { WeeklySchedule } from "@burger-page/contracts"

// 2026-10-05 is a Monday; Bogota is UTC-5, so 15:00Z is 10:00 local.
const MONDAY_10_LOCAL = new Date("2026-10-05T15:00:00Z")
const mondayNoonToTen: WeeklySchedule = [{ dayOfWeek: 1, open: "12:00", close: "22:00" }]
const bogota = "America/Bogota"

describe("useStoreOpenStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(MONDAY_10_LOCAL)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("is closed before opening and reports the next opening", () => {
    const { result } = renderHook(() =>
      useStoreOpenStatus({ schedule: mondayNoonToTen, timezone: bogota, ordersPaused: false })
    )
    expect(result.current.isOpen).toBe(false)
    expect(result.current.reason).toBe("closed")
    expect(result.current.next).toEqual({ dayOfWeek: 1, time: "12:00", daysAhead: 0 })
  })

  it("flips to open on its own when the minute tick crosses the opening time", () => {
    const { result } = renderHook(() =>
      useStoreOpenStatus({ schedule: mondayNoonToTen, timezone: bogota, ordersPaused: false })
    )
    expect(result.current.isOpen).toBe(false)
    act(() => {
      vi.advanceTimersByTime(2 * 60 * 60 * 1000 + 60 * 1000) // 12:01 local
    })
    expect(result.current.isOpen).toBe(true)
    expect(result.current.reason).toBeNull()
  })

  it("flips back to closed after closing time", () => {
    vi.setSystemTime(new Date("2026-10-06T02:59:00Z")) // Monday 21:59 local
    const { result } = renderHook(() =>
      useStoreOpenStatus({ schedule: mondayNoonToTen, timezone: bogota, ordersPaused: false })
    )
    expect(result.current.isOpen).toBe(true)
    act(() => {
      vi.advanceTimersByTime(60 * 1000)
    })
    expect(result.current.isOpen).toBe(false)
  })

  it("paused wins over an open schedule", () => {
    vi.setSystemTime(new Date("2026-10-05T18:00:00Z")) // 13:00 local, inside hours
    const { result } = renderHook(() =>
      useStoreOpenStatus({ schedule: mondayNoonToTen, timezone: bogota, ordersPaused: true })
    )
    expect(result.current.isOpen).toBe(false)
    expect(result.current.reason).toBe("paused")
  })

  it("reads the schedule in the restaurant timezone, not the browser's", () => {
    // 15:00Z is 17:00 in Madrid (UTC+2 in October): inside 12:00-22:00.
    const { result } = renderHook(() =>
      useStoreOpenStatus({ schedule: mondayNoonToTen, timezone: "Europe/Madrid", ordersPaused: false })
    )
    expect(result.current.isOpen).toBe(true)
  })

  it("an empty schedule is always closed with no next opening", () => {
    const { result } = renderHook(() => useStoreOpenStatus({ schedule: [], timezone: bogota, ordersPaused: false }))
    expect(result.current.isOpen).toBe(false)
    expect(result.current.next).toBeNull()
  })

  it("stops ticking on unmount", () => {
    const clear = vi.spyOn(globalThis, "clearInterval")
    const { unmount } = renderHook(() =>
      useStoreOpenStatus({ schedule: mondayNoonToTen, timezone: bogota, ordersPaused: false })
    )
    unmount()
    expect(clear).toHaveBeenCalled()
  })
})
