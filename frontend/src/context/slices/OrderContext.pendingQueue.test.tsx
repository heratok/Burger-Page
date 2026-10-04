import React from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query"
import { seedBlankActiveTenant } from "@/test/fixtures"
import { createTestQueryClient } from "@/test/testQueryClient"
import { keys } from "@/core/query/keys"
import type { Order } from "@/types/restaurant"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

import { toast } from "sonner"
import { TenantProvider } from "./TenantContext"
import { UiProvider } from "./UiContext"
import { OrderProvider, useOrders } from "./OrderContext"
import type { OrderBoard } from "./orderBoard"
import { apiClient } from "@/core/api/apiClient"
import { pendingOrdersQueue, PENDING_ORDERS_KEY } from "@/core/storage/pendingOrdersQueue"
import { TenantRepository } from "@/core/storage/TenantRepository"

const TENANT = "rest-burger-craft"

const sale: Omit<Order, "id" | "orderNumber" | "createdAt" | "updatedAt"> = {
  customer: { nombre: "Offline Tester", telefono: "3006665544", direccion: "Calle 6", barrio: "Centro" },
  items: [{ id: "i1", name: "Burger", price: 20000, cantidad: 1, total: 20000, adiciones: [] }],
  total: 20000,
  deliveryFee: 0,
  finalTotal: 20000,
  metodo: "Efectivo",
  status: "pending",
}

function mount(client: QueryClient = createTestQueryClient()) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>
      <TenantProvider>
        <UiProvider>
          <OrderProvider>{children}</OrderProvider>
        </UiProvider>
      </TenantProvider>
    </QueryClientProvider>
  )
  return { client, ...renderHook(() => useOrders(), { wrapper }) }
}

/** Places a sale while the create call fails at the network level. */
async function placeOfflineSale(result: { current: ReturnType<typeof useOrders> }) {
  let placed!: ReturnType<ReturnType<typeof useOrders>["addOrder"]>
  act(() => {
    placed = result.current.addOrder(sale)
  })
  const server = await placed.serverPromise
  expect(server?.offline).toBe(true)
  return placed
}

describe("offline sales live in the persisted pending-orders queue", () => {
  beforeEach(() => {
    localStorage.clear()
    seedBlankActiveTenant()
    vi.restoreAllMocks()
    vi.mocked(toast.error).mockClear()
    vi.mocked(toast.warning).mockClear()
    vi.mocked(toast.success).mockClear()
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    vi.spyOn(apiClient, "subscribeToOrderStream").mockImplementation(() => () => {})
    vi.spyOn(apiClient, "fetchOrders").mockResolvedValue([])
    vi.spyOn(apiClient, "fetchCustomers").mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("keeps an offline sale visible as pendingSync in the queue, not in the cached board", async () => {
    vi.spyOn(apiClient, "createOrder").mockRejectedValue(new TypeError("Failed to fetch"))
    const { result, client } = mount()
    await waitFor(() => expect(apiClient.fetchOrders).toHaveBeenCalled())

    const placed = await placeOfflineSale(result)

    await waitFor(() => expect(result.current.orders.map((o) => o.id)).toEqual([placed.id]))
    expect(result.current.orders[0].pendingSync).toBe(true)
    expect(pendingOrdersQueue.list(TENANT).map((o) => o.id)).toEqual([placed.id])
    expect(client.getQueryData<OrderBoard>(keys.orders(TENANT, "guest"))?.orders ?? []).toHaveLength(0)
  })

  it("survives a remount with a fresh QueryClient (reload) and keeps its correlation id", async () => {
    const createSpy = vi.spyOn(apiClient, "createOrder").mockRejectedValue(new TypeError("Failed to fetch"))
    const first = mount()
    const placed = await placeOfflineSale(first.result)
    first.unmount()

    const second = mount(createTestQueryClient())
    await waitFor(() => expect(second.result.current.orders.map((o) => o.id)).toEqual([placed.id]))
    expect(second.result.current.orders[0].pendingSync).toBe(true)

    // The retry after the first read re-sends the SAME clientOrderId.
    await waitFor(() => expect(createSpy.mock.calls.length).toBeGreaterThanOrEqual(2))
    const ids = createSpy.mock.calls.map(([input]) => (input as any).clientOrderId)
    expect(new Set(ids).size).toBe(1)
  })

  it("is retried on the browser 'online' event, removed from the queue and adopted on success", async () => {
    const createSpy = vi
      .spyOn(apiClient, "createOrder")
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue({ id: "srv-1", orderNumber: 4242, status: "pending" } as any)
    const { result, client } = mount()
    await waitFor(() => expect(apiClient.fetchOrders).toHaveBeenCalled())
    await placeOfflineSale(result)
    // The first read already happened, so no automatic retry until a trigger.
    await act(async () => {
      window.dispatchEvent(new Event("online"))
    })

    await waitFor(() => expect(result.current.orders.map((o) => o.id)).toEqual(["srv-1"]))
    expect(createSpy).toHaveBeenCalledTimes(2)
    expect(result.current.orders[0].pendingSync).toBeFalsy()
    expect(result.current.orders[0].orderNumber).toBe(4242)
    expect(pendingOrdersQueue.list(TENANT)).toEqual([])
    expect(client.getQueryData<OrderBoard>(keys.orders(TENANT, "guest"))?.orders.map((o) => o.id)).toEqual(["srv-1"])
  })

  it("is removed from the queue with an error toast when the server rejects the retry", async () => {
    vi.spyOn(apiClient, "createOrder")
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValue(Object.assign(new Error("Producto no encontrado"), { status: 400 }))
    const { result } = mount()
    await waitFor(() => expect(apiClient.fetchOrders).toHaveBeenCalled())
    const placed = await placeOfflineSale(result)

    await act(async () => {
      await result.current.refreshOrders()
    })

    expect(result.current.orders).toEqual([])
    expect(pendingOrdersQueue.list(TENANT)).toEqual([])
    expect(toast.error).toHaveBeenCalledWith(`No se pudo registrar la orden #${placed.orderNumber}`, expect.anything())
  })

  it("can be deleted locally like any card (the server never had it)", async () => {
    vi.spyOn(apiClient, "createOrder").mockRejectedValue(new TypeError("Failed to fetch"))
    vi.spyOn(apiClient, "deleteOrder").mockRejectedValue(Object.assign(new Error("not found"), { status: 404 }))
    const { result } = mount()
    await waitFor(() => expect(apiClient.fetchOrders).toHaveBeenCalled())
    const placed = await placeOfflineSale(result)

    await act(async () => {
      await result.current.deleteOrder(placed.id)
    })

    expect(result.current.orders).toEqual([])
    expect(pendingOrdersQueue.list(TENANT)).toEqual([])
  })

  it("adopts a pending sale persisted by the previous version inside the tenant envelope", async () => {
    const legacy = JSON.parse(localStorage.getItem("burger_page_platform_v2")!)
    legacy.restaurants[0].orders = [
      { ...sale, id: "ord-legacy", orderNumber: 606, createdAt: "2026-08-01T14:00:00.000Z", updatedAt: "2026-08-01T14:00:00.000Z", pendingSync: true },
    ]
    localStorage.setItem("burger_page_platform_v2", JSON.stringify(legacy))
    vi.spyOn(apiClient, "createOrder").mockRejectedValue(new TypeError("Failed to fetch"))

    const { result } = mount()

    await waitFor(() => expect(result.current.orders.map((o) => o.id)).toEqual(["ord-legacy"]))
    expect(pendingOrdersQueue.list(TENANT).map((o) => o.id)).toEqual(["ord-legacy"])
  })

  it("is purged with the rest of the tenant data on logout", () => {
    pendingOrdersQueue.add(TENANT, { ...sale, id: "ord-x", orderNumber: 1, createdAt: "", updatedAt: "", pendingSync: true })
    new TenantRepository().purgeTenantData()
    expect(localStorage.getItem(PENDING_ORDERS_KEY)).toBeNull()
    expect(pendingOrdersQueue.list(TENANT)).toEqual([])
  })
})
