import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query"
import { seedBlankActiveTenant } from "@/test/fixtures"
import { createTestQueryClient } from "@/test/testQueryClient"
import { keys } from "@/core/query/keys"
import type { Order } from "@/types/restaurant"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

import { TenantProvider, useTenant } from "./TenantContext"
import { UiProvider } from "./UiContext"
import { OrderProvider, useOrders } from "./OrderContext"
import { apiClient } from "@/core/api/apiClient"

const TENANT = "rest-burger-craft"

const backendOrder = (id: string, orderNumber: number, status = "pending") => ({
  id,
  orderNumber,
  status,
  subtotal: 10000,
  deliveryFee: 0,
  finalTotal: 10000,
  createdAt: new Date(2026, 7, 1, 12, orderNumber).toISOString(),
  updatedAt: new Date(2026, 7, 1, 12, orderNumber).toISOString(),
  customer: { name: `Cliente ${orderNumber}`, phone: `300000${orderNumber}` },
})

const domainOrder = (id: string, orderNumber: number): Order => ({
  id,
  orderNumber,
  customer: { nombre: "Cache Client", telefono: "3001", direccion: "x", barrio: "y" },
  items: [],
  total: 1000,
  deliveryFee: 0,
  finalTotal: 1000,
  metodo: "Efectivo",
  status: "pending",
  createdAt: "2026-08-01T12:00:00.000Z",
  updatedAt: "2026-08-01T12:00:00.000Z",
})

function setup(client: QueryClient = createTestQueryClient()) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>
      <TenantProvider>
        <UiProvider>
          <OrderProvider>{children}</OrderProvider>
        </UiProvider>
      </TenantProvider>
    </QueryClientProvider>
  )
  return { client, wrapper }
}

describe("OrderContext reads orders and customers from the query cache", () => {
  beforeEach(() => {
    localStorage.clear()
    seedBlankActiveTenant()
    vi.restoreAllMocks()
    vi.spyOn(apiClient, "subscribeToOrderStream").mockImplementation(() => () => {})
  })

  it("useOrders reflects the orders query data", async () => {
    vi.spyOn(apiClient, "hasToken").mockReturnValue(false)
    const { client, wrapper } = setup()
    const { result } = renderHook(() => useOrders(), { wrapper })

    act(() => {
      client.setQueryData(keys.orders(TENANT, "guest"), {
        orders: [domainOrder("cached-1", 11)],
        customers: [],
      })
    })

    expect(result.current.orders.map((o) => o.id)).toEqual(["cached-1"])
    expect(result.current.pendingOrdersCount).toBe(1)
  })

  it("a refetch with identical data keeps the orders and customers identity", async () => {
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    vi.spyOn(apiClient, "fetchOrders").mockImplementation(async () => [backendOrder("A", 1), backendOrder("B", 2)] as any)
    vi.spyOn(apiClient, "fetchCustomers").mockImplementation(async () => [{ id: "c1", name: "C", phone: "3000001" }] as any)
    const { client, wrapper } = setup()
    const { result } = renderHook(() => useOrders(), { wrapper })
    await waitFor(() => expect(result.current.orders).toHaveLength(2))
    const before = { orders: result.current.orders, customers: result.current.customers }

    await act(async () => {
      await client.refetchQueries({ queryKey: keys.orders(TENANT, "guest") })
    })

    expect(apiClient.fetchOrders).toHaveBeenCalledTimes(2)
    expect(result.current.orders).toBe(before.orders)
    expect(result.current.customers).toBe(before.customers)
  })

  it("keeps an unchanged order's identity when another order changes", async () => {
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    const fetchOrders = vi
      .spyOn(apiClient, "fetchOrders")
      .mockImplementation(async () => [backendOrder("A", 1), backendOrder("B", 2)] as any)
    vi.spyOn(apiClient, "fetchCustomers").mockResolvedValue([])
    const { client, wrapper } = setup()
    const { result } = renderHook(() => useOrders(), { wrapper })
    await waitFor(() => expect(result.current.orders).toHaveLength(2))
    const orderA = result.current.orders.find((o) => o.id === "A")

    fetchOrders.mockImplementation(async () => [backendOrder("A", 1), backendOrder("B", 2, "cooking")] as any)
    await act(async () => {
      await client.refetchQueries({ queryKey: keys.orders(TENANT, "guest") })
    })

    expect(result.current.orders.find((o) => o.id === "B")?.status).toBe("cooking")
    expect(result.current.orders.find((o) => o.id === "A")).toBe(orderA)
  })

  it("still mirrors the cached board into the tenant record (dual write)", async () => {
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    vi.spyOn(apiClient, "fetchOrders").mockResolvedValue([backendOrder("A", 1)] as any)
    vi.spyOn(apiClient, "fetchCustomers").mockResolvedValue([])
    const { wrapper } = setup()
    const { result } = renderHook(() => ({ orders: useOrders(), tenant: useTenant() }), { wrapper })

    await waitFor(() => expect(result.current.orders.orders).toHaveLength(1))
    await waitFor(() => expect(result.current.tenant.activeRestaurant.orders.map((o) => o.id)).toEqual(["A"]))
  })
})
