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
