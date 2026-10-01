import { describe, it, expect } from "vitest"
import {
  DAY_DISPLAY_ORDER,
  DAY_NAMES,
  ALWAYS_OPEN_SCHEDULE,
  scheduleFieldsFromApi,
  splitConfigForApi,
  rangesForDay,
  formatRanges,
} from "./storeSchedule"
import { DEFAULT_STORE_CONFIG } from "@/constants/themePresets"

describe("storeSchedule helpers", () => {
  it("lists Monday first and Sunday last in the display order", () => {
    expect(DAY_DISPLAY_ORDER).toEqual([1, 2, 3, 4, 5, 6, 0])
    expect(DAY_NAMES[1]).toBe("Lunes")
    expect(DAY_NAMES[0]).toBe("Domingo")
  })

  it("the default schedule is open around the clock on all 7 days", () => {
    expect(ALWAYS_OPEN_SCHEDULE).toHaveLength(7)
    expect(DEFAULT_STORE_CONFIG.schedule).toEqual(ALWAYS_OPEN_SCHEDULE)
    expect(DEFAULT_STORE_CONFIG.timezone).toBe("America/Bogota")
    expect(DEFAULT_STORE_CONFIG.ordersPaused).toBe(false)
  })

  describe("scheduleFieldsFromApi", () => {
    it("reads schedule, timezone and ordersPaused from the API payload", () => {
      const schedule = [{ dayOfWeek: 2, open: "10:00", close: "22:00" }]
      expect(scheduleFieldsFromApi({ schedule, timezone: "America/Mexico_City", ordersPaused: true })).toEqual({
        schedule,
        timezone: "America/Mexico_City",
        ordersPaused: true,
      })
    })

    it("keeps an empty schedule (always closed) instead of replacing it with the default", () => {
      expect(scheduleFieldsFromApi({ schedule: [] }).schedule).toEqual([])
    })

    it("falls back to the defaults when the payload predates the schedule", () => {
      expect(scheduleFieldsFromApi({})).toEqual({
        schedule: ALWAYS_OPEN_SCHEDULE,
        timezone: "America/Bogota",
        ordersPaused: false,
      })
    })
  })

  describe("splitConfigForApi", () => {
    it("moves the schedule fields to the top level and drops the legacy text", () => {
      const schedule = [{ dayOfWeek: 1, open: "09:00", close: "18:00" }]
      const out = splitConfigForApi({
        tagline: "x",
        schedule,
        timezone: "America/Lima",
        ordersPaused: false,
        openingHours: "legacy",
      } as never)
      expect(out).toEqual({
        config: { tagline: "x" },
        schedule,
        timezone: "America/Lima",
        ordersPaused: false,
      })
    })

    it("does not invent schedule fields that were not part of the update", () => {
      expect(splitConfigForApi({ tagline: "x" })).toEqual({ config: { tagline: "x" } })
    })
  })

  describe("rangesForDay / formatRanges", () => {
    const schedule = [
      { dayOfWeek: 1, open: "18:00", close: "22:00" },
      { dayOfWeek: 1, open: "09:00", close: "14:00" },
      { dayOfWeek: 3, open: "20:00", close: "02:00" },
    ]
    it("returns the day's ranges sorted by opening time", () => {
      expect(rangesForDay(schedule, 1).map((r) => r.open)).toEqual(["09:00", "18:00"])
      expect(rangesForDay(schedule, 2)).toEqual([])
    })
    it("joins several ranges and shows Cerrado for an empty day", () => {
      expect(formatRanges(rangesForDay(schedule, 1))).toBe("09:00 - 14:00, 18:00 - 22:00")
      expect(formatRanges([])).toBe("Cerrado")
    })
  })
})
