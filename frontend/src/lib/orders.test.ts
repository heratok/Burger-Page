import { afterEach, describe, expect, it, vi } from "vitest"
import {
  ALLOWED_TRANSITIONS,
  canTransition,
  computeSalesMetrics,
  createUniqueOrderId,
} from "./orders"
import type { Order, OrderStatus } from "./domain"

const STATUSES: OrderStatus[] = ["new", "confirmed", "delivered", "cancelled"]

// Expected matrix per design contract: new→{confirmed,cancelled},
// confirmed→{delivered,cancelled}; delivered and cancelled are terminal.
const EXPECTED: Record<OrderStatus, Record<OrderStatus, boolean>> = {
  new: { new: false, confirmed: true, delivered: false, cancelled: true },
  confirmed: { new: false, confirmed: false, delivered: true, cancelled: true },
  delivered: { new: false, confirmed: false, delivered: false, cancelled: false },
  cancelled: { new: false, confirmed: false, delivered: false, cancelled: false },
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("canTransition", () => {
  it("matches the full 4×4 transition matrix", () => {
    for (const from of STATUSES) {
      for (const to of STATUSES) {
        expect(canTransition(from, to), `${from} → ${to}`).toBe(EXPECTED[from][to])
      }
    }
  })

  it("keeps ALLOWED_TRANSITIONS in sync with the matrix", () => {
    for (const from of STATUSES) {
      for (const to of STATUSES) {
        expect(ALLOWED_TRANSITIONS[from].includes(to), `${from} → ${to}`).toBe(
          EXPECTED[from][to]
        )
      }
    }
  })
})

describe("createUniqueOrderId", () => {
  it("returns a 6-digit id (100000–999999) that is not already used", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5)
    const id = createUniqueOrderId(new Set([111111]))
    expect(id).toBeGreaterThanOrEqual(100000)
    expect(id).toBeLessThanOrEqual(999999)
    expect(id).not.toBe(111111)
  })

  it("retries when the random pick collides with an existing id", () => {
    // 0.5 → 550000 (used), 0.8 → 820000 (free)
    const spy = vi
      .spyOn(Math, "random")
      .mockReturnValueOnce(0.5)
      .mockReturnValue(0.8)
    expect(createUniqueOrderId(new Set([550000]))).toBe(820000)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it("falls back to the lowest free id when every retry collides", () => {
    // Every random pick hits 550000 (in use); only 123456 is free.
    vi.spyOn(Math, "random").mockReturnValue(0.5)
    const used = new Set<number>()
    for (let id = 100000; id <= 999999; id++) {
      if (id !== 123456) used.add(id)
    }
    expect(createUniqueOrderId(used)).toBe(123456)
  })
})

function makeOrder(partial: Partial<Order> & Pick<Order, "id" | "createdAt">): Order {
  return {
    items: [],
    customer: { nombre: "Ana", telefono: "3001234567", direccion: "Calle 1", barrio: "Centro" },
    metodo: "Efectivo",
    total: 0,
    status: "new",
    ...partial,
  }
}

describe("computeSalesMetrics", () => {
  const now = new Date("2026-08-16T12:00:00")

  it("counts only confirmed|delivered and excludes cancelled", () => {
    const orders = [
      makeOrder({ id: 1, createdAt: "2026-08-16T09:00:00", status: "confirmed", total: 30000 }),
      makeOrder({ id: 2, createdAt: "2026-08-16T10:00:00", status: "delivered", total: 25000 }),
      makeOrder({ id: 3, createdAt: "2026-08-16T11:00:00", status: "cancelled", total: 99999 }),
      makeOrder({ id: 4, createdAt: "2026-08-15T23:00:00", status: "confirmed", total: 10000 }),
    ]
    const metrics = computeSalesMetrics(orders, now)
    expect(metrics.today).toEqual({ count: 2, revenue: 55000 })
    expect(metrics.allTime).toEqual({ count: 3, revenue: 65000 })
  })

  it("returns zeros for an empty order list", () => {
    const metrics = computeSalesMetrics([], now)
    expect(metrics.today).toEqual({ count: 0, revenue: 0 })
    expect(metrics.allTime).toEqual({ count: 0, revenue: 0 })
  })

  it("respects the calendar-day boundary (00:00 today counts, 23:59 yesterday does not)", () => {
    const orders = [
      makeOrder({ id: 1, createdAt: "2026-08-16T00:00:00", status: "confirmed", total: 1000 }),
      makeOrder({ id: 2, createdAt: "2026-08-15T23:59:59", status: "confirmed", total: 2000 }),
      makeOrder({ id: 3, createdAt: "2026-08-16T08:00:00", status: "cancelled", total: 3000 }),
    ]
    const metrics = computeSalesMetrics(orders, now)
    expect(metrics.today).toEqual({ count: 1, revenue: 1000 })
    expect(metrics.allTime).toEqual({ count: 2, revenue: 3000 })
  })
})