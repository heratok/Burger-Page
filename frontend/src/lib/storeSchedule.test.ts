import { describe, it, expect } from "vitest"
import type { WeeklySchedule } from "@burger-page/contracts"
import {
  DAY_DISPLAY_ORDER,
  DAY_NAMES,
  ALWAYS_OPEN_SCHEDULE,
  scheduleFieldsFromApi,
  splitConfigForApi,
  rangesForDay,
  formatRanges,
  describeNextOpening,
  closedMessage,
  isOvernightRange,
  copyRangeToWeekdays,
  copyRangeToWeekend,
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

  describe("isOvernightRange", () => {
    it("detects when close time is strictly earlier than open time", () => {
      expect(isOvernightRange("20:00", "02:00")).toBe(true)
      expect(isOvernightRange("23:30", "04:00")).toBe(true)
      expect(isOvernightRange("09:00", "18:00")).toBe(false)
      expect(isOvernightRange("00:00", "00:00")).toBe(false) // 24h is not overnight crossing
      expect(isOvernightRange("12:00", "12:00")).toBe(false)
    })
  })

  describe("copyRangeToWeekdays and copyRangeToWeekend shortcuts", () => {
    const baseSchedule: WeeklySchedule = [
      { dayOfWeek: 1, open: "09:00", close: "18:00" },
      { dayOfWeek: 6, open: "13:00", close: "02:00" },
      { dayOfWeek: 0, open: "14:00", close: "20:00" },
    ]

    it("copies Monday hours across all weekdays (Lun-Vie) preserving weekend", () => {
      const result = copyRangeToWeekdays(baseSchedule, 1)
      const weekdays = [1, 2, 3, 4, 5]
      for (const d of weekdays) {
        expect(result.filter((r) => r.dayOfWeek === d)).toEqual([
          { dayOfWeek: d, open: "09:00", close: "18:00" },
        ])
      }
      // Weekend is untouched
      expect(result.find((r) => r.dayOfWeek === 6)).toEqual({ dayOfWeek: 6, open: "13:00", close: "02:00" })
      expect(result.find((r) => r.dayOfWeek === 0)).toEqual({ dayOfWeek: 0, open: "14:00", close: "20:00" })
    })

    it("copies Saturday hours across the weekend (Sab-Dom) preserving weekdays", () => {
      const result = copyRangeToWeekend(baseSchedule, 6)
      expect(result.filter((r) => r.dayOfWeek === 6)).toEqual([
        { dayOfWeek: 6, open: "13:00", close: "02:00" },
      ])
      expect(result.filter((r) => r.dayOfWeek === 0)).toEqual([
        { dayOfWeek: 0, open: "13:00", close: "02:00" },
      ])
      // Monday is untouched
      expect(result.find((r) => r.dayOfWeek === 1)).toEqual({ dayOfWeek: 1, open: "09:00", close: "18:00" })
    })
  })
})

describe("describeNextOpening / closedMessage", () => {
  it("says hoy and mañana for the next two days", () => {
    expect(describeNextOpening({ dayOfWeek: 1, time: "12:00", daysAhead: 0 })).toBe("Abrimos hoy a las 12:00")
    expect(describeNextOpening({ dayOfWeek: 2, time: "09:30", daysAhead: 1 })).toBe("Abrimos mañana a las 09:30")
  })
  it("names the weekday otherwise", () => {
    expect(describeNextOpening({ dayOfWeek: 5, time: "18:00", daysAhead: 4 })).toBe("Abrimos el viernes a las 18:00")
  })
  it("has no sentence when there is no next opening", () => {
    expect(describeNextOpening(null)).toBeNull()
  })
  it("builds the checkout block message per reason", () => {
    expect(closedMessage("closed")).toBe("Este restaurante se encuentra fuera del horario de atención.")
    expect(closedMessage("paused")).toBe("Este restaurante tiene los pedidos en pausa en este momento.")
  })
})
