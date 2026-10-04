import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query"
import type { OrderEvent } from "@burger-page/contracts"
import { seedBlankActiveTenant } from "@/test/fixtures"
import { createTestQueryClient } from "@/test/testQueryClient"
import { keys } from "@/core/query/keys"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

import { TenantProvider } from "./TenantContext"
import { UiProvider } from "./UiContext"
import { OrderProvider, useOrders } from "./OrderContext"
import type { OrderBoard } from "./orderBoard"
import { apiClient } from "@/core/api/apiClient"

const TENANT = "rest-burger-craft"

const backendOrder = (id: string, orderNumber: number) => ({
  id,
  orderNumber,
  status: "pending",
  subtotal: 10000,
  deliveryFee: 0,
  finalTotal: 10000,
  createdAt: new Date(2026, 7, 1, 12, orderNumber).toISOString(),
  customer: { name: `Cliente ${orderNumber}`, phone: `300000${orderNumber}` },
})

const created = (orderId: string, orderNumber: number): OrderEvent =>
  ({
    eventType: "ORDER_CREATED",
    orderId,
    orderNumber,
    status: "pending",
    timestamp: new Date().toISOString(),
    payload: { customer: { nombre: "SSE", telefono: "3009", direccion: "x", barrio: "y" }, items: [], subtotal: 1, deliveryFee: 0, finalTotal: 1 },
  }) as any

let onEvent: ((e: OrderEvent) => void) | undefined
let streamTenant: string | undefined

function setup(client: QueryClient = createTestQueryClient()) {
  vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
  vi.spyOn(apiClient, "fetchCustomers").mockResolvedValue([])
  vi.spyOn(apiClient, "subscribeToOrderStream").mockImplementation(((handler: any, restaurantId?: string) => {
    onEvent = handler
    streamTenant = restaurantId
    return () => {}
  }) as any)
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>
      <TenantProvider>
        <UiProvider>
          <OrderProvider>{children}</OrderProvider>
        </UiProvider>
      </TenantProvider>
    </QueryClientProvider>
  )
  return { client, hook: renderHook(() => useOrders(), { wrapper }) }
}

describe("OrderContext SSE events write into the query cache", () => {
  beforeEach(() => {
    localStorage.clear()
    seedBlankActiveTenant()
    vi.restoreAllMocks()
    onEvent = undefined
  })

  it("applies an event to the stream tenant's cached board", async () => {
    vi.spyOn(apiClient, "fetchOrders").mockResolvedValue([backendOrder("A", 1)] as any)
    const { client, hook } = setup()
    await waitFor(() => expect(hook.result.current.orders).toHaveLength(1))

    act(() => onEvent!(created("B", 2)))

    expect(streamTenant).toBe(TENANT)
    const board = client.getQueryData<OrderBoard>(keys.orders(TENANT, "guest"))
    expect(board?.orders.map((o) => o.id)).toEqual(["B", "A"])
  })

  it("an event that arrives before the first read is shown and merged with the read", async () => {
    let release!: (orders: any[]) => void
    vi.spyOn(apiClient, "fetchOrders").mockImplementation(() => new Promise((res) => (release = res)))
    const { client, hook } = setup()
    await waitFor(() => expect(onEvent).toBeDefined())

    act(() => onEvent!(created("B", 2)))

    expect(hook.result.current.orders.map((o) => o.id)).toEqual(["B"])
    expect(client.getQueryData<OrderBoard>(keys.orders(TENANT, "guest"))?.orders).toHaveLength(1)

    await act(async () => release([backendOrder("B", 2), backendOrder("A", 1)]))
    await waitFor(() => expect(hook.result.current.orders.map((o) => o.id)).toEqual(["B", "A"]))
    expect(hook.result.current.isLoadingOrders).toBe(false)
  })

  it("never writes an event into another tenant's or role's board", async () => {
    vi.spyOn(apiClient, "fetchOrders").mockResolvedValue([backendOrder("A", 1)] as any)
    const { client, hook } = setup()
    await waitFor(() => expect(hook.result.current.orders).toHaveLength(1))
    const other = { orders: [], customers: [] }
    client.setQueryData(keys.orders("rest-other", "guest"), other)
    client.setQueryData(keys.orders(TENANT, "super"), other)

    act(() => onEvent!(created("B", 2)))

    expect(client.getQueryData(keys.orders("rest-other", "guest"))).toBe(other)
    expect(client.getQueryData(keys.orders(TENANT, "super"))).toBe(other)
  })
})
