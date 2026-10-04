import { describe, it, expect, vi } from "vitest"
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

  it("reads the order board regardless of navigator.onLine and without structural sharing", () => {
    const opts = ordersQueryOptions("t", "restaurant")
    expect(opts.networkMode).toBe("always")
    expect(opts.structuralSharing).toBe(false)
  })

  it("reads orders and customers together; a failed customers read falls back to []", async () => {
    vi.spyOn(apiClient, "fetchOrders").mockResolvedValue([{ id: "o1" }] as any)
    vi.spyOn(apiClient, "fetchCustomers").mockRejectedValue(new Error("boom"))
    const board = await (ordersQueryOptions("t", "restaurant").queryFn as any)()
    expect(board).toEqual({ orders: [{ id: "o1" }], customers: [] })
  })
})
