import { useEffect, useMemo, useState } from "react"
import { isOpenAt, nextOpening } from "@burger-page/contracts"
import type { NextOpening } from "@burger-page/contracts"
import type { StorefrontConfig } from "@/types/restaurant"
import { ALWAYS_OPEN_SCHEDULE, DEFAULT_TIMEZONE, type ClosedReason } from "@/lib/storeSchedule"

export interface StoreOpenStatus {
  isOpen: boolean
  /** Why orders are blocked; null while open. Paused wins over the schedule. */
  reason: ClosedReason | null
  /** Next opening (restaurant timezone) while closed by schedule; null if it never opens. */
  next: NextOpening | null
}

const TICK_MS = 60_000

/**
 * Whether the storefront accepts orders right now: not paused and inside the
 * weekly schedule, evaluated in the restaurant's timezone. Re-evaluated every
 * minute so a page left open flips between Abierto and Cerrado by itself.
 */
export function useStoreOpenStatus(
  config: Partial<Pick<StorefrontConfig, "schedule" | "timezone" | "ordersPaused">>
): StoreOpenStatus {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), TICK_MS)
    return () => clearInterval(id)
  }, [])

  // Records that predate the schedule (partial configs) behave as before: always open.
  const schedule = config.schedule ?? ALWAYS_OPEN_SCHEDULE
  const timezone = config.timezone ?? DEFAULT_TIMEZONE
  const ordersPaused = Boolean(config.ordersPaused)
  return useMemo(() => {
    const open = isOpenAt(schedule, now, timezone)
    if (ordersPaused) return { isOpen: false, reason: "paused", next: null }
    if (open) return { isOpen: true, reason: null, next: null }
    return { isOpen: false, reason: "closed", next: nextOpening(schedule, now, timezone) }
  }, [schedule, timezone, ordersPaused, now])
}
