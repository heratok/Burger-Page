import type { MetodoPago, Order, OrderStatus } from "./domain"

/**
 * Pure analytics layer for the Resumen dashboard (design DR-2/DR-3, AC-1/2/3).
 * All functions are deterministic and side-effect free, taking orders (plus a
 * `now` reference for windowing) and returning plain data.
 */

export type ResumenRange = "today" | "7d" | "30d" | "all"

export interface DayBucket {
  /** Calendar day, YYYY-MM-DD. */
  day: string
  revenue: number
}

/** Orders whose status counts toward revenue/ticket/customers (AC-1). */
const COUNTED_STATUSES: ReadonlySet<OrderStatus> = new Set([
  "confirmed",
  "delivered",
])

/** Formats a Date as YYYY-MM-DD in local time (matches the calendar day). */
function toDayString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** True when the order's calendar day equals the reference day. */
function isSameDay(order: Order, now: Date): boolean {
  return toDayString(new Date(order.createdAt)) === toDayString(now)
}

/** True when the order is not older than `days` calendar days (incl. today). */
function withinLastDays(order: Order, now: Date, days: number): boolean {
  const cutoff = new Date(startOfDay(now).getTime() - (days - 1) * 86_400_000)
  return new Date(order.createdAt) >= cutoff
}

const DAY_MS = 86_400_000

/**
 * Filters orders to the active range window (design DR-2):
 * - today: only the reference calendar day
 * - 7d: last 7 calendar days ending today
 * - 30d: last 30 calendar days ending today
 * - all: every order (no date filter)
 */
export function ordersInRange(
  orders: Order[],
  range: ResumenRange,
  now: Date
): Order[] {
  switch (range) {
    case "today":
      return orders.filter((o) => isSameDay(o, now))
    case "7d":
      return orders.filter((o) => withinLastDays(o, now, 7))
    case "30d":
      return orders.filter((o) => withinLastDays(o, now, 30))
    case "all":
      return orders
  }
}

/** Number of daily buckets per range (design D3, AC-2). */
function bucketCount(range: ResumenRange): number {
  switch (range) {
    case "today":
      return 1
    case "7d":
      return 7
    case "30d":
      return 30
    case "all":
      return 14
  }
}

/**
 * Daily revenue buckets for the range (design D3, AC-2): Today → 1 bucket;
 * 7/30d → last N days inclusive ending today; All → last 14 days. Days without
 * orders render as zero. Only confirmed|delivered revenue counts (AC-1).
 */
export function revenueByDay(
  orders: Order[],
  range: ResumenRange,
  now: Date
): DayBucket[] {
  const count = bucketCount(range)
  const revenueByDayMap = new Map<string, number>()
  const inRange = ordersInRange(orders, range, now)
  for (const order of inRange) {
    if (!COUNTED_STATUSES.has(order.status)) continue
    const day = toDayString(new Date(order.createdAt))
    revenueByDayMap.set(day, (revenueByDayMap.get(day) ?? 0) + order.total)
  }
  const today = startOfDay(now)
  const buckets: DayBucket[] = []
  for (let i = count - 1; i >= 0; i--) {
    const day = new Date(today.getTime() - i * DAY_MS)
    buckets.push({ day: toDayString(day), revenue: revenueByDayMap.get(toDayString(day)) ?? 0 })
  }
  return buckets
}

/**
 * Order-status breakdown over the (already in-range) orders. Cancelled orders
 * remain visible here (AC-1 "cancelled visible").
 */
export function statusBreakdown(
  orders: Order[]
): Record<OrderStatus, number> {
  const breakdown: Record<OrderStatus, number> = {
    new: 0,
    confirmed: 0,
    delivered: 0,
    cancelled: 0,
  }
  for (const order of orders) {
    breakdown[order.status] += 1
  }
  return breakdown
}

/** Payment-method split over the (already in-range) orders. */
export function paymentSplit(
  orders: Order[]
): Record<MetodoPago, number> {
  const split: Record<MetodoPago, number> = {
    Efectivo: 0,
    Transferencia: 0,
  }
  for (const order of orders) {
    split[order.metodo] += 1
  }
  return split
}

/**
 * Average ticket = revenue / non-cancelled order count (AC-1). Returns 0 when
 * there are no countable orders (avoids division by zero).
 */
export function averageTicket(orders: Order[]): number {
  const countable = orders.filter((o) => COUNTED_STATUSES.has(o.status))
  if (countable.length === 0) return 0
  const revenue = countable.reduce((sum, o) => sum + o.total, 0)
  return revenue / countable.length
}

/** Distinct customer phones among non-cancelled orders (AC-1). */
export function uniqueCustomers(orders: Order[]): number {
  const phones = new Set<string>()
  for (const order of orders) {
    if (!COUNTED_STATUSES.has(order.status)) continue
    phones.add(order.customer.telefono)
  }
  return phones.size
}
