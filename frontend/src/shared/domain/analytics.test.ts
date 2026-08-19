import { describe, expect, it } from "vitest"
import {
  averageTicket,
  ordersInRange,
  paymentSplit,
  revenueByDay,
  statusBreakdown,
  uniqueCustomers,
} from "./analytics"
import type { Order } from "./domain"

const NOW = new Date("2026-08-16T12:00:00")

function makeOrder(
  partial: Partial<Order> & { id: number }
): Order {
  return {
    items: [],
    customer: { nombre: "Ana", telefono: "3001234567", direccion: "Calle 1", barrio: "Centro" },
    metodo: "Efectivo",
    total: 0,
    status: "new",
    createdAt: "2026-08-16T12:00:00",
    ...partial,
  }
}

describe("ordersInRange", () => {
  it("includes only orders from the last 7 calendar days for 7d (day -6 in, -7 out)", () => {
    const orders = [
      makeOrder({ id: 1, createdAt: "2026-08-16T10:00:00" }), // today
      makeOrder({ id: 2, createdAt: "2026-08-10T23:00:00" }), // today - 6 (earliest of 7-day window)
      makeOrder({ id: 3, createdAt: "2026-08-09T23:00:00" }), // today - 7 (excluded)
    ]
    const ids = ordersInRange(orders, "7d", NOW).map((o) => o.id)
    expect(ids).toEqual([1, 2])
  })

  it("includes only today's orders for the today range", () => {
    const orders = [
      makeOrder({ id: 1, createdAt: "2026-08-16T09:00:00" }), // today
      makeOrder({ id: 2, createdAt: "2026-08-15T23:00:00" }), // yesterday
    ]
    const ids = ordersInRange(orders, "today", NOW).map((o) => o.id)
    expect(ids).toEqual([1])
  })

  it("includes every order for the all range regardless of date", () => {
    const orders = [
      makeOrder({ id: 1, createdAt: "2026-08-16T09:00:00" }),
      makeOrder({ id: 2, createdAt: "2026-01-01T00:00:00" }),
    ]
    const ids = ordersInRange(orders, "all", NOW).map((o) => o.id)
    expect(ids).toEqual([1, 2])
  })

  it("includes the last 30 calendar days for 30d (day -29 in, -30 out)", () => {
    const orders = [
      makeOrder({ id: 1, createdAt: "2026-07-18T10:00:00" }), // today - 29
      makeOrder({ id: 2, createdAt: "2026-07-17T10:00:00" }), // today - 30
    ]
    const ids = ordersInRange(orders, "30d", NOW).map((o) => o.id)
    expect(ids).toEqual([1])
  })
})

describe("revenueByDay", () => {
  it("returns exactly one bucket for the today range with today's revenue", () => {
    const orders = [
      makeOrder({ id: 1, createdAt: "2026-08-16T09:00:00", status: "confirmed", total: 30000 }),
      makeOrder({ id: 2, createdAt: "2026-08-15T09:00:00", status: "confirmed", total: 99999 }),
    ]
    const buckets = revenueByDay(orders, "today", NOW)
    expect(buckets).toEqual([{ day: "2026-08-16", revenue: 30000 }])
  })

  it("returns 7 buckets for 7d, oldest first, with empty days as zero", () => {
    const orders = [
      makeOrder({ id: 1, createdAt: "2026-08-16T09:00:00", status: "confirmed", total: 10000 }),
      makeOrder({ id: 2, createdAt: "2026-08-10T09:00:00", status: "delivered", total: 20000 }),
    ]
    const buckets = revenueByDay(orders, "7d", NOW)
    expect(buckets).toHaveLength(7)
    expect(buckets[0]).toEqual({ day: "2026-08-10", revenue: 20000 })
    expect(buckets[5]).toEqual({ day: "2026-08-15", revenue: 0 }) // empty day zero
    expect(buckets[6]).toEqual({ day: "2026-08-16", revenue: 10000 })
  })

  it("returns 30 buckets for 30d", () => {
    const buckets = revenueByDay([], "30d", NOW)
    expect(buckets).toHaveLength(30)
    expect(buckets[0].day).toBe("2026-07-18")
    expect(buckets[29].day).toBe("2026-08-16")
  })

  it("caps the all range at the last 14 days (14 buckets)", () => {
    const buckets = revenueByDay([], "all", NOW)
    expect(buckets).toHaveLength(14)
    expect(buckets[0].day).toBe("2026-08-03")
    expect(buckets[13].day).toBe("2026-08-16")
  })

  it("excludes cancelled orders from revenue buckets", () => {
    const orders = [
      makeOrder({ id: 1, createdAt: "2026-08-16T09:00:00", status: "confirmed", total: 30000 }),
      makeOrder({ id: 2, createdAt: "2026-08-16T10:00:00", status: "cancelled", total: 50000 }),
    ]
    const buckets = revenueByDay(orders, "today", NOW)
    expect(buckets[0].revenue).toBe(30000)
  })
})

describe("statusBreakdown", () => {
  it("counts every status including cancelled", () => {
    const orders = [
      makeOrder({ id: 1, status: "new" }),
      makeOrder({ id: 2, status: "confirmed" }),
      makeOrder({ id: 3, status: "delivered" }),
      makeOrder({ id: 4, status: "cancelled" }),
    ]
    expect(statusBreakdown(orders)).toEqual({
      new: 1,
      confirmed: 1,
      delivered: 1,
      cancelled: 1,
    })
  })

  it("returns zero for every status when there are no orders", () => {
    expect(statusBreakdown([])).toEqual({
      new: 0,
      confirmed: 0,
      delivered: 0,
      cancelled: 0,
    })
  })
})

describe("paymentSplit", () => {
  it("counts orders by payment method", () => {
    const orders = [
      makeOrder({ id: 1, metodo: "Efectivo" }),
      makeOrder({ id: 2, metodo: "Efectivo" }),
      makeOrder({ id: 3, metodo: "Transferencia" }),
    ]
    expect(paymentSplit(orders)).toEqual({ Efectivo: 2, Transferencia: 1 })
  })

  it("returns zero for both methods when there are no orders", () => {
    expect(paymentSplit([])).toEqual({ Efectivo: 0, Transferencia: 0 })
  })
})

describe("averageTicket", () => {
  it("divides revenue by the non-cancelled order count", () => {
    const orders = [
      makeOrder({ id: 1, status: "confirmed", total: 30000 }),
      makeOrder({ id: 2, status: "delivered", total: 10000 }),
      makeOrder({ id: 3, status: "cancelled", total: 50000 }), // excluded
    ]
    expect(averageTicket(orders)).toBe(20000)
  })

  it("returns 0 when there are no non-cancelled orders", () => {
    expect(averageTicket([])).toBe(0)
    expect(averageTicket([makeOrder({ id: 1, status: "cancelled", total: 100 })])).toBe(0)
  })
})

describe("uniqueCustomers", () => {
  it("counts distinct customer phones among non-cancelled orders", () => {
    const orders = [
      makeOrder({ id: 1, status: "confirmed", customer: { ...makeOrder({ id: 1, createdAt: "x" }).customer, telefono: "3001111111" } }),
      makeOrder({ id: 2, status: "delivered", customer: { ...makeOrder({ id: 1, createdAt: "x" }).customer, telefono: "3001111111" } }),
      makeOrder({ id: 3, status: "confirmed", customer: { ...makeOrder({ id: 1, createdAt: "x" }).customer, telefono: "3002222222" } }),
      makeOrder({ id: 4, status: "cancelled", customer: { ...makeOrder({ id: 1, createdAt: "x" }).customer, telefono: "3003333333" } }), // excluded
    ]
    expect(uniqueCustomers(orders)).toBe(2)
  })

  it("returns 0 when there are no non-cancelled orders", () => {
    expect(uniqueCustomers([])).toBe(0)
  })
})
