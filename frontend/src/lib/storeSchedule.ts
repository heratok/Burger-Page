import type { NextOpening, OpeningRange, WeeklySchedule } from "@burger-page/contracts"
import type { StorefrontConfig } from "@/types/restaurant"

/** Display order of the week: Monday first, Sunday (0) last. */
export const DAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

/** Spanish weekday names indexed by dayOfWeek (0 = Sunday). */
export const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as const

export const DEFAULT_TIMEZONE = "America/Bogota"

/** Open around the clock (open == close spans a full day), every day. */
export const ALWAYS_OPEN_SCHEDULE: WeeklySchedule = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
  dayOfWeek,
  open: "00:00",
  close: "00:00",
}))

type ScheduleFields = Pick<StorefrontConfig, "schedule" | "timezone" | "ordersPaused">

/**
 * Reads the schedule fields from a restaurant API payload. An empty schedule
 * is meaningful (always closed) and is kept; only a payload that predates the
 * feature (no `schedule` at all) falls back to "always open", the previous
 * behavior.
 */
export function scheduleFieldsFromApi(raw: {
  schedule?: unknown
  timezone?: unknown
  ordersPaused?: unknown
}): ScheduleFields {
  return {
    schedule: Array.isArray(raw.schedule) ? (raw.schedule as WeeklySchedule) : ALWAYS_OPEN_SCHEDULE,
    timezone: typeof raw.timezone === "string" && raw.timezone ? raw.timezone : DEFAULT_TIMEZONE,
    ordersPaused: Boolean(raw.ordersPaused),
  }
}

/**
 * Splits a (partial) storefront config into the PUT /restaurants/:id payload:
 * the schedule fields travel at the top level, the legacy free-text hours are
 * never sent, and only fields present in `config` are included.
 */
export function splitConfigForApi(config: Partial<StorefrontConfig>): {
  config: Record<string, unknown>
  schedule?: WeeklySchedule
  timezone?: string
  ordersPaused?: boolean
} {
  const {
    schedule,
    timezone,
    ordersPaused,
    openingHours: _legacyText,
    ...rest
  } = config as Partial<StorefrontConfig> & { openingHours?: string }
  return {
    config: rest,
    ...(schedule !== undefined ? { schedule } : {}),
    ...(timezone !== undefined ? { timezone } : {}),
    ...(ordersPaused !== undefined ? { ordersPaused } : {}),
  }
}

/** The ranges of one weekday, sorted by opening time. */
export function rangesForDay(schedule: WeeklySchedule, dayOfWeek: number): OpeningRange[] {
  return schedule.filter((r) => r.dayOfWeek === dayOfWeek).sort((a, b) => a.open.localeCompare(b.open))
}

/** "09:00 - 14:00, 18:00 - 22:00", "24 horas" for a full-day range, "Cerrado" when empty. */
export function formatRanges(ranges: OpeningRange[]): string {
  if (ranges.length === 0) return "Cerrado"
  return ranges.map((r) => (r.open === r.close ? "24 horas" : `${r.open} - ${r.close}`)).join(", ")
}

export type ClosedReason = "closed" | "paused"

/** "Abrimos hoy a las 12:00" / "mañana" / "el viernes"; null when the store never opens. */
export function describeNextOpening(next: NextOpening | null): string | null {
  if (!next) return null
  const when =
    next.daysAhead === 0 ? "hoy" : next.daysAhead === 1 ? "mañana" : `el ${DAY_NAMES[next.dayOfWeek].toLowerCase()}`
  return `Abrimos ${when} a las ${next.time}`
}

/** Block message shown in the cart and checkout while the store cannot take orders. */
export function closedMessage(reason: ClosedReason): string {
  return reason === "paused"
    ? "Este restaurante tiene los pedidos en pausa en este momento."
    : "Este restaurante se encuentra fuera del horario de atención."
}

/** Returns true if closing time is strictly earlier than opening time (spans across midnight). */
export function isOvernightRange(open: string, close: string): boolean {
  if (!open || !close) return false
  return open !== close && close < open
}

/** Weekday numbers in standard index (1 = Lunes .. 5 = Viernes). */
export const WEEKDAY_NUMBERS = [1, 2, 3, 4, 5] as const

/** Weekend numbers in standard index (6 = Sábado, 0 = Domingo). */
export const WEEKEND_NUMBERS = [6, 0] as const

/** Copies a reference day's first range to all weekdays (Lun–Vie), preserving weekends. */
export function copyRangeToWeekdays(schedule: WeeklySchedule, sourceDayOfWeek: number = 1): WeeklySchedule {
  const [first] = rangesForDay(schedule, sourceDayOfWeek)
  const nonWeekdays = schedule.filter((r) => !(WEEKDAY_NUMBERS as readonly number[]).includes(r.dayOfWeek))
  if (!first) {
    return nonWeekdays
  }
  const weekdayRanges: WeeklySchedule = WEEKDAY_NUMBERS.map((d) => ({
    dayOfWeek: d,
    open: first.open,
    close: first.close,
  }))
  return [...nonWeekdays, ...weekdayRanges]
}

/** Copies a reference day's first range across the weekend (Sáb–Dom), preserving weekdays. */
export function copyRangeToWeekend(schedule: WeeklySchedule, sourceDayOfWeek: number = 6): WeeklySchedule {
  const [first] = rangesForDay(schedule, sourceDayOfWeek)
  const nonWeekend = schedule.filter((r) => !(WEEKEND_NUMBERS as readonly number[]).includes(r.dayOfWeek))
  if (!first) {
    return nonWeekend
  }
  const weekendRanges: WeeklySchedule = WEEKEND_NUMBERS.map((d) => ({
    dayOfWeek: d,
    open: first.open,
    close: first.close,
  }))
  return [...nonWeekend, ...weekendRanges]
}

/** Returns true if opening and closing times are identical (spans a full 24-hour day in the domain model). */
export function is24HourRange(open: string, close: string): boolean {
  if (!open || !close) return false
  return open === close
}

/** Sets a day's first range to 24 hours (00:00-00:00), preserving any extra ranges. */
export function setDay24Hours(schedule: WeeklySchedule, day: number): WeeklySchedule {
  const [, ...extras] = rangesForDay(schedule, day)
  const otherDays = schedule.filter((r) => r.dayOfWeek !== day)
  return [...otherDays, { dayOfWeek: day, open: "00:00", close: "00:00" }, ...extras]
}

/** Sets a day's first range to custom opening and closing hours, preserving any extra ranges. */
export function setDayCustomHours(
  schedule: WeeklySchedule,
  day: number,
  open: string = "12:00",
  close: string = "22:30"
): WeeklySchedule {
  const [, ...extras] = rangesForDay(schedule, day)
  const otherDays = schedule.filter((r) => r.dayOfWeek !== day)
  return [...otherDays, { dayOfWeek: day, open, close }, ...extras]
}

/** Sets all 7 days to 24 hours (00:00-00:00). */
export function setAll24Hours(): WeeklySchedule {
  return DAY_DISPLAY_ORDER.map((day) => ({ dayOfWeek: day, open: "00:00", close: "00:00" }))
}

/** Applies an opening range to a specified list of days, enabling them if they were closed. */
export function applyRangeToDays(
  schedule: WeeklySchedule,
  targetDays: readonly number[],
  open: string,
  close: string
): WeeklySchedule {
  const unmodified = schedule.filter((r) => !targetDays.includes(r.dayOfWeek))
  const updated: WeeklySchedule = targetDays.map((d) => ({
    dayOfWeek: d,
    open,
    close,
  }))
  return [...unmodified, ...updated]
}

