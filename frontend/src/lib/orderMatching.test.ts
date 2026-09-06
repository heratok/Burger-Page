import { describe, it, expect, vi } from "vitest"
import type { Order } from "@/types/restaurant"
import { resolveModalOrder } from "./orderMatching"

function makeOrder(id: string, orderNumber: number, customerName: string): Order {
  return {
    id,
    orderNumber,
    customer: { nombre: customerName, telefono: "3000000000", direccion: "", barrio: "" },
    items: [],
    total: 0,
    deliveryFee: 0,
    finalTotal: 0,
    metodo: "Efectivo",
    status: "pending",
    createdAt: "2026-09-06T12:00:00.000Z",
    updatedAt: "2026-09-06T12:00:00.000Z",
  }
}

describe("lib/orderMatching — resolveModalOrder", () => {
  it("returns null when no order is selected", () => {
    expect(resolveModalOrder([], null)).toBeNull()
  })

  it("returns the selectedOrder when orders array is empty", () => {
    const selected = makeOrder("ord-x", 10180, "Cliente A")
    expect(resolveModalOrder([], selected)).toBe(selected)
  })

  it("returns the matching order from orders when found and consistent", () => {
    const a = makeOrder("server-A", 10180, "Cliente A")
    const b = makeOrder("server-B", 25, "Cliente B")

    // user clicked an order whose id now points to backend id
    const selectedFromClick = makeOrder("server-A", 10180, "Cliente A")
    expect(resolveModalOrder([a, b], selectedFromClick)).toBe(a)
  })

  it("falls back to selectedOrder when find() returns an order with different orderNumber (id-collision drift)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const a = makeOrder("server-A", 10180, "Cliente A")
    const b = makeOrder("server-B", 25, "Cliente B")
    const wrong = makeOrder("server-X", 999, "Cliente X")
    const orders = [wrong, a, b]

    // selectedOrder has stale data with the correct orderNumber 25 (Cliente B)
    const selected = makeOrder("server-X", 25, "Cliente B")

    const resolved = resolveModalOrder(orders, selected)
    // should NOT return `wrong` (different orderNumber) — fall back to selected
    expect(resolved).toBe(selected)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("order id collision detected"),
      expect.objectContaining({
        selectedId: "server-X",
        selectedOrderNumber: 25,
      })
    )
    warn.mockRestore()
  })

  it("falls back to selectedOrder when find() returns an order with different customer (id-collision drift)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const wrong = makeOrder("server-Y", 50, "Cliente Y")
    const selected = makeOrder("server-Y", 50, "Cliente Z") // different customer

    const resolved = resolveModalOrder([wrong], selected)
    expect(resolved).toBe(selected)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it("returns the found order when id matches and orderNumber/customer match (no false-positive warn)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const order = makeOrder("server-A", 10180, "Cliente A")
    // selected with same id, same orderNumber, same customer
    const selected = makeOrder("server-A", 10180, "Cliente A")

    expect(resolveModalOrder([order], selected)).toBe(order)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
