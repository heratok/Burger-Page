import { describe, it, expect, vi } from "vitest"
import { QueryClient } from "@tanstack/react-query"
import { apiClient } from "@/core/api/apiClient"
import { keys } from "./keys"
import {
  ordersQueryOptions,
  productsQueryOptions,
  additionsQueryOptions,
  inventoryQueryOptions,
  suppliersQueryOptions,
  restaurantsQueryOptions,
  restaurantQueryOptions,
  restaurantStatusQueryOptions,
} from "./options"

describe("per-resource query options", () => {
  it("binds each resource to its factory key", () => {
    expect(ordersQueryOptions("t", "restaurant").queryKey).toEqual(keys.orders("t", "restaurant"))
    expect(productsQueryOptions("t", "guest", "s").queryKey).toEqual(keys.products("t", "guest", "s"))
    expect(additionsQueryOptions("t", "guest", "s").queryKey).toEqual(keys.additions("t", "guest", "s"))
    expect(inventoryQueryOptions("t", "super").queryKey).toEqual(keys.inventory("t", "super"))
    expect(suppliersQueryOptions("t", "super").queryKey).toEqual(keys.suppliers("t", "super"))
    expect(restaurantsQueryOptions("super").queryKey).toEqual(keys.restaurants("super"))
    expect(restaurantQueryOptions("guest", "x").queryKey).toEqual(keys.restaurant("guest", "x"))
    expect(restaurantStatusQueryOptions("guest", "x").queryKey).toEqual(keys.restaurantStatus("guest", "x"))
  })

  it("never retries a tenant read (the slices own their refresh points)", () => {
    for (const opts of [
      ordersQueryOptions("t", "restaurant"),
      productsQueryOptions("t", "guest", "s"),
      additionsQueryOptions("t", "guest", "s"),
      inventoryQueryOptions("t", "super"),
      suppliersQueryOptions("t", "super"),
    ]) {
      expect(opts.retry).toBe(false)
    }
  })

  it("reads the order board regardless of navigator.onLine, with structural sharing", () => {
    const opts = ordersQueryOptions("t", "restaurant")
    expect(opts.networkMode).toBe("always")
    // Structural sharing stays on: unchanged orders keep their identity.
    expect(opts.structuralSharing).toBeUndefined()
  })

  it("reads orders and customers together into a domain board; a failed customers read falls back to []", async () => {
    vi.spyOn(apiClient, "fetchOrders").mockResolvedValue([{ id: "o1", orderNumber: 7, status: "pending" }] as any)
    vi.spyOn(apiClient, "fetchCustomers").mockRejectedValue(new Error("boom"))
    const opts = ordersQueryOptions("t", "restaurant")
    const client = new QueryClient()
    const board = await (opts.queryFn as any)({ client, queryKey: opts.queryKey })
    expect(board.orders.map((o: any) => [o.id, o.orderNumber, o.status])).toEqual([["o1", 7, "pending"]])
    expect(board.customers).toEqual([])
  })
})
