import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { seedBlankActiveTenant, TEST_ORDERS, TEST_CUSTOMERS, readPersistedQuery } from "@/test/fixtures"
import type { RestaurantRecord } from "@/types/restaurant"
import { RestaurantProvider, useRestaurant } from "@/context/RestaurantContext"
import { apiClient } from "@/core/api/apiClient"
import { TenantRepository, STORAGE_KEYS } from "@/core/storage/TenantRepository"
import { InMemoryStorageAdapter } from "@/core/storage/StorageAdapter"
import { PendingOrdersQueue } from "@/core/storage/pendingOrdersQueue"
import { appQueryClient } from "@/core/query/queryClient"
import { keys } from "@/core/query/keys"
import { PERSISTED_QUERIES_KEY } from "@/core/query/persistence"


describe("orders and customers are no longer part of the tenant envelope", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    seedBlankActiveTenant()
  })

  it("order activity is never persisted into the tenant record", async () => {
    vi.spyOn(apiClient, "createOrder").mockResolvedValue({ id: "srv-1", orderNumber: 77 } as any)
    const { result } = renderHook(() => useRestaurant(), {
      wrapper: ({ children }: { children: React.ReactNode }) => <RestaurantProvider>{children}</RestaurantProvider>,
    })

    let placed!: ReturnType<typeof result.current.addOrder>
    act(() => {
      placed = result.current.addOrder({
        customer: { nombre: "Cliente", telefono: "3001112222", direccion: "Calle 1", barrio: "Centro" },
        items: [],
        total: 10000,
        deliveryFee: 0,
        finalTotal: 10000,
        metodo: "Efectivo",
        status: "pending",
      })
    })
    await placed.serverPromise
    await waitFor(() => expect(result.current.orders.map((o) => o.id)).toEqual(["srv-1"]))
    expect(result.current.customers).toHaveLength(1)

    // No tenant envelope is written at all, and the order is not in the
    // persisted (storefront-only) query cache either.
    expect(localStorage.getItem(STORAGE_KEYS.ENVELOPE)).toBeNull()
    expect(localStorage.getItem(PERSISTED_QUERIES_KEY) ?? "").not.toContain("srv-1")
    expect(result.current.activeRestaurant.orders ?? []).toEqual([])
  })

  it("the legacy migration never carries orders and customers over", () => {
    const adapter = new InMemoryStorageAdapter()
    adapter.setItem(
      STORAGE_KEYS.ENVELOPE,
      JSON.stringify({
        version: 2,
        restaurants: [
          { id: "r1", slug: "r1", isActive: true, createdAt: "", config: {}, categories: ["A"], products: [], additions: [], orders: TEST_ORDERS, customers: TEST_CUSTOMERS },
        ],
      })
    )
    const queue = new PendingOrdersQueue(adapter)
    new TenantRepository(adapter, queue).migrateLegacyEnvelope()

    const record = readPersistedQuery<RestaurantRecord>(keys.restaurant("guest", "r1"))
    expect(record?.id).toBe("r1")
    expect(record?.orders).toBeUndefined()
    expect(record?.customers).toBeUndefined()
    expect(localStorage.getItem(PERSISTED_QUERIES_KEY)).not.toContain(TEST_ORDERS[0].id)
    expect(queue.list("r1")).toEqual([])
  })

  it("platform stats come from the server, never from the order boards read in this session", async () => {
    sessionStorage.setItem("burger_page_session_v2", JSON.stringify({ role: "super", authenticatedAt: new Date().toISOString() }))
    vi.spyOn(apiClient, "listRestaurants").mockResolvedValue([])
    vi.spyOn(apiClient, "fetchPlatformStats").mockResolvedValue({
      totalRevenue: 500,
      totalOrders: 42,
      totalCustomers: 9,
      totalRestaurants: 3,
      activeRestaurants: 2,
    })
    const { result } = renderHook(() => useRestaurant(), {
      wrapper: ({ children }: { children: React.ReactNode }) => <RestaurantProvider>{children}</RestaurantProvider>,
    })
    await waitFor(() => expect(result.current.globalStats.totalOrders).toBe(42))

    act(() => {
      appQueryClient.setQueryData(keys.orders("rest-burger-craft", "super"), {
        orders: TEST_ORDERS,
        customers: TEST_CUSTOMERS,
      })
    })

    expect(result.current.globalStats.totalOrders).toBe(42)
    expect(result.current.globalStats.totalCustomers).toBe(9)
  })
})
