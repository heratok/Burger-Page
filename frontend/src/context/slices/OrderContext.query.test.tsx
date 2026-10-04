import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { QueryClientProvider, onlineManager } from "@tanstack/react-query"
import type { OrderEvent } from "@burger-page/contracts"
import { seedBlankActiveTenant } from "@/test/fixtures"
import { createTestQueryClient } from "@/test/testQueryClient"
import { createQueryClient } from "@/core/query/queryClient"
import { toast } from "sonner"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

import { TenantProvider, useTenant } from "./TenantContext"
import { UiProvider } from "./UiContext"
import { OrderProvider, useOrders } from "./OrderContext"
import { apiClient } from "@/core/api/apiClient"

const backendOrder = (id: string, orderNumber: number, status = "pending", extra: object = {}) => ({
  id,
  orderNumber,
  status,
  subtotal: 10000,
  deliveryFee: 0,
  finalTotal: 10000,
  createdAt: new Date(2026, 7, 1, 12, orderNumber).toISOString(),
  customer: { name: `Cliente ${orderNumber}`, phone: `300000${orderNumber}` },
  ...extra,
})

const backendCustomer = (id: string, phone: string) => ({ id, name: `Cust ${id}`, phone, address: "x", barrio: "y" })

function setup(client = createTestQueryClient()) {
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

let sse: { onEvent?: (e: OrderEvent) => void; onReconnect?: () => void; subscribed: number }

function mockSse() {
  sse = { subscribed: 0 }
  vi.spyOn(apiClient, "subscribeToOrderStream").mockImplementation(((
    onEvent: any,
    _r?: string,
    onReconnect?: () => void
  ) => {
    sse.subscribed += 1
    sse.onEvent = onEvent
    sse.onReconnect = onReconnect
    return () => {}
  }) as any)
}

const createdEvent = (orderId: string, orderNumber: number): OrderEvent =>
  ({
    eventType: "ORDER_CREATED",
    orderId,
    orderNumber,
    status: "pending",
    timestamp: new Date().toISOString(),
    payload: {
      customer: { nombre: "Nuevo", telefono: "3009999", direccion: "x", barrio: "y" },
      items: [],
      subtotal: 1,
      deliveryFee: 0,
      finalTotal: 1,
    },
  }) as any

describe("OrderContext reads and SSE catch-up (TanStack Query)", () => {
  beforeEach(() => {
    localStorage.clear()
    seedBlankActiveTenant()
    vi.restoreAllMocks()
    mockSse()
  })

  it("hydrates orders and customers and exposes loading only until the first fetch settles", async () => {
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    let release!: (v: any[]) => void
    vi.spyOn(apiClient, "fetchOrders").mockImplementation(() => new Promise((res) => (release = res)))
    vi.spyOn(apiClient, "fetchCustomers").mockResolvedValue([backendCustomer("c1", "3000001")])
    const { wrapper } = setup()
    const { result } = renderHook(() => useOrders(), { wrapper })

    expect(result.current.isLoadingOrders).toBe(true)
    await act(async () => release([backendOrder("A", 1)]))
    await waitFor(() => expect(result.current.orders.map((o) => o.id)).toEqual(["A"]))
    expect(result.current.customers.map((c) => c.id)).toEqual(["c1"])
    expect(result.current.isLoadingOrders).toBe(false)
  })

  it("keys the cache per resource, tenant and role", async () => {
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    vi.spyOn(apiClient, "fetchOrders").mockResolvedValue([backendOrder("A", 1)] as any)
    vi.spyOn(apiClient, "fetchCustomers").mockResolvedValue([])
    const { client, wrapper } = setup()
    const { result } = renderHook(() => ({ orders: useOrders(), tenant: useTenant() }), { wrapper })
    await waitFor(() => expect(result.current.orders.orders).toHaveLength(1))

    const keys = client.getQueryCache().findAll({ queryKey: ["orders"] }).map((q) => q.queryKey)
    expect(keys).toHaveLength(1)
    expect(keys[0][1]).toBe(result.current.tenant.activeRestaurant.id)
    expect(typeof keys[0][2]).toBe("string")
  })

  it("reuses the cached read on remount within the same client instead of refetching", async () => {
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    const fetchSpy = vi.spyOn(apiClient, "fetchOrders").mockResolvedValue([backendOrder("A", 1)] as any)
    vi.spyOn(apiClient, "fetchCustomers").mockResolvedValue([])
    const { wrapper } = setup()
    const first = renderHook(() => useOrders(), { wrapper })
    await waitFor(() => expect(first.result.current.orders).toHaveLength(1))
    first.unmount()

    const second = renderHook(() => useOrders(), { wrapper })
    await waitFor(() => expect(second.result.current.orders).toHaveLength(1))
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("never requests private endpoints without a token (anonymous checkout) yet still places the order", async () => {
    vi.spyOn(apiClient, "hasToken").mockReturnValue(false)
    const fetchOrders = vi.spyOn(apiClient, "fetchOrders").mockResolvedValue([] as any)
    const fetchCustomers = vi.spyOn(apiClient, "fetchCustomers").mockResolvedValue([])
    const createSpy = vi.spyOn(apiClient, "createOrder").mockResolvedValue({ id: "srv-1", orderNumber: 4242 } as any)
    const { client, wrapper } = setup()
    const { result } = renderHook(() => useOrders(), { wrapper })

    let placed!: ReturnType<typeof result.current.addOrder>
    act(() => {
      placed = result.current.addOrder({
        customer: { nombre: "Anon", telefono: "3001112222", direccion: "Calle 1", barrio: "Centro" },
        items: [],
        total: 10000,
        deliveryFee: 0,
        finalTotal: 10000,
        metodo: "Efectivo",
        status: "pending",
      } as any)
    })
    // Synchronous return, optimistic card already present.
    expect(placed.id).toMatch(/^ord/)
    expect(result.current.orders.some((o) => o.id === placed.id)).toBe(true)

    const server = await placed.serverPromise
    expect(server?.adoptedOrderNumber).toBe(4242)
    expect(createSpy).toHaveBeenCalledTimes(1)
    await act(() => new Promise((r) => setTimeout(r, 30)))
    expect(fetchOrders).not.toHaveBeenCalled()
    expect(fetchCustomers).not.toHaveBeenCalled()
    expect(sse.subscribed).toBe(0)
    expect(client.getQueryCache().findAll({ queryKey: ["orders"] }).every((q) => q.state.fetchStatus === "idle")).toBe(true)
  })

  it("applies an incoming SSE order event to state", async () => {
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    vi.spyOn(apiClient, "fetchOrders").mockResolvedValue([backendOrder("A", 1)] as any)
    vi.spyOn(apiClient, "fetchCustomers").mockResolvedValue([])
    const { wrapper } = setup()
    const { result } = renderHook(() => useOrders(), { wrapper })
    await waitFor(() => expect(result.current.orders).toHaveLength(1))

    act(() => sse.onEvent!(createdEvent("B", 2)))
    expect(result.current.orders.map((o) => o.id)).toEqual(["B", "A"])
  })

  it("an SSE reconnect triggers exactly one silent refetch (no loading flag)", async () => {
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    const fetchOrders = vi.spyOn(apiClient, "fetchOrders").mockResolvedValue([backendOrder("A", 1)] as any)
    const fetchCustomers = vi.spyOn(apiClient, "fetchCustomers").mockResolvedValue([])
    const { wrapper } = setup()
    const loadingStates: boolean[] = []
    const { result } = renderHook(
      () => {
        const o = useOrders()
        loadingStates.push(o.isLoadingOrders)
        return o
      },
      { wrapper }
    )
    await waitFor(() => expect(result.current.orders).toHaveLength(1))
    await waitFor(() => expect(result.current.isLoadingOrders).toBe(false))
    loadingStates.length = 0
    expect(fetchOrders).toHaveBeenCalledTimes(1)

    // Hold the catch-up open so the in-flight render is observable; return a NEW array.
    let release!: (v: any[]) => void
    fetchOrders.mockImplementation(() => new Promise((res) => (release = res)))
    act(() => sse.onReconnect!())
    await waitFor(() => expect(fetchOrders).toHaveBeenCalledTimes(2))
    await act(() => new Promise((r) => setTimeout(r, 20)))
    expect(result.current.isLoadingOrders).toBe(false)

    await act(async () => release([backendOrder("A", 1), backendOrder("M", 9)]))
    await waitFor(() => expect(result.current.orders.some((o) => o.id === "M")).toBe(true))
    expect(fetchOrders).toHaveBeenCalledTimes(2)
    expect(fetchCustomers).toHaveBeenCalledTimes(2)
    expect(loadingStates).not.toContain(true)
  })

  it("an explicit refreshOrders always asks the server again and shows loading while it runs", async () => {
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    const fetchOrders = vi.spyOn(apiClient, "fetchOrders").mockResolvedValue([backendOrder("A", 1)] as any)
    vi.spyOn(apiClient, "fetchCustomers").mockResolvedValue([])
    const { wrapper } = setup()
    const { result } = renderHook(() => useOrders(), { wrapper })
    await waitFor(() => expect(result.current.orders).toHaveLength(1))

    let release!: (v: any[]) => void
    fetchOrders.mockImplementation(() => new Promise((res) => (release = res)))
    let done!: Promise<void>
    act(() => {
      done = result.current.refreshOrders()
    })
    await waitFor(() => expect(result.current.isLoadingOrders).toBe(true))
    await act(async () => {
      release([backendOrder("A", 1), backendOrder("B", 2)])
      await done
    })
    expect(fetchOrders).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(result.current.orders).toHaveLength(2))
    expect(result.current.isLoadingOrders).toBe(false)
  })

  it("a failed customers read still hydrates orders (customers fall back to empty)", async () => {
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    vi.spyOn(apiClient, "fetchOrders").mockResolvedValue([backendOrder("A", 1)] as any)
    vi.spyOn(apiClient, "fetchCustomers").mockRejectedValue(new Error("boom"))
    const { wrapper } = setup()
    const { result } = renderHook(() => useOrders(), { wrapper })
    await waitFor(() => expect(result.current.orders).toHaveLength(1))
    expect(result.current.customers).toEqual([])
  })

  it("a failed orders read leaves local data untouched and clears loading", async () => {
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    vi.spyOn(apiClient, "fetchOrders").mockRejectedValue(new Error("down"))
    vi.spyOn(apiClient, "fetchCustomers").mockResolvedValue([])
    const { wrapper } = setup()
    const { result } = renderHook(() => useOrders(), { wrapper })
    await waitFor(() => expect(result.current.isLoadingOrders).toBe(false))
    expect(result.current.orders).toEqual([])
  })
})

const WRITES_KEY = ["order-writes"]
const statusOf = (r: { current: { orders: any[] } }, id: string) => r.current.orders.find((o) => o.id === id)?.status

describe("OrderContext writes (TanStack Query mutations)", () => {
  beforeEach(() => {
    localStorage.clear()
    seedBlankActiveTenant()
    vi.restoreAllMocks()
    vi.mocked(toast.error).mockClear()
    vi.mocked(toast.success).mockClear()
    mockSse()
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    vi.spyOn(apiClient, "fetchCustomers").mockResolvedValue([])
  })

  async function ready(orders: any[], client = createTestQueryClient()) {
    const fetchOrders = vi
      .spyOn(apiClient, "fetchOrders")
      .mockImplementation(async () => orders.map((o) => ({ ...o })) as any)
    const { wrapper } = setup(client)
    const hook = renderHook(() => useOrders(), { wrapper })
    await waitFor(() => expect(hook.result.current.orders).toHaveLength(orders.length))
    return { ...hook, client, fetchOrders }
  }

  it("tracks every write as a mutation while it is in flight", async () => {
    const { result, client } = await ready([backendOrder("A", 1)])
    let release!: (v: any) => void
    vi.spyOn(apiClient, "updateOrderStatus").mockImplementation(() => new Promise((res) => (release = res)))

    act(() => result.current.updateOrderStatus("A", "cooking"))
    await waitFor(() => expect(client.isMutating({ mutationKey: WRITES_KEY })).toBe(1))
    await act(async () => release({}))
    await waitFor(() => expect(client.isMutating({ mutationKey: WRITES_KEY })).toBe(0))
  })

  it("revalidates once, only after the last in-flight write settles", async () => {
    const { result, fetchOrders } = await ready([backendOrder("A", 1), backendOrder("B", 2)])
    const releases: Array<(v: any) => void> = []
    vi.spyOn(apiClient, "updateOrderStatus").mockImplementation(() => new Promise((res) => releases.push(res)))
    expect(fetchOrders).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.updateOrderStatus("A", "cooking")
      result.current.updateOrderStatus("B", "cooking")
    })
    await waitFor(() => expect(releases).toHaveLength(2))
    await act(async () => releases[0]({}))
    await act(() => new Promise((r) => setTimeout(r, 30)))
    expect(fetchOrders).toHaveBeenCalledTimes(1)

    await act(async () => releases[1]({}))
    await waitFor(() => expect(fetchOrders).toHaveBeenCalledTimes(2))
  })

  it("revalidates every order resource (orders and customers) after a customer write", async () => {
    const { result, fetchOrders } = await ready([backendOrder("A", 1)])
    const fetchCustomers = vi.mocked(apiClient.fetchCustomers)
    vi.spyOn(apiClient, "updateCustomer").mockResolvedValue({} as any)
    const before = fetchCustomers.mock.calls.length

    await act(async () => {
      await result.current.updateCustomer("c1", { notes: "vip" })
    })
    await waitFor(() => expect(fetchOrders).toHaveBeenCalledTimes(2))
    expect(fetchCustomers.mock.calls.length).toBe(before + 1)
  })

  it("an SSE event for an order with a pending status change does not revert the optimistic value", async () => {
    const { result, fetchOrders } = await ready([backendOrder("A", 1), backendOrder("C", 3)])
    let release!: (v: any) => void
    vi.spyOn(apiClient, "updateOrderStatus").mockImplementation(() => new Promise((res) => (release = res)))

    act(() => result.current.updateOrderStatus("A", "cooking"))
    expect(statusOf(result, "A")).toBe("cooking")

    act(() => {
      // Stale echo for A (pending write) and a legitimate event for C.
      sse.onEvent!({ eventType: "ORDER_STATUS_UPDATED", orderId: "A", status: "pending", timestamp: new Date().toISOString() } as any)
      sse.onEvent!({ eventType: "ORDER_STATUS_UPDATED", orderId: "C", status: "delivered", timestamp: new Date().toISOString() } as any)
    })
    expect(statusOf(result, "A")).toBe("cooking")
    expect(statusOf(result, "C")).toBe("delivered")

    // The server settles on cooking; the settle revalidation reconciles.
    fetchOrders.mockImplementation(async () => [backendOrder("A", 1, "cooking"), backendOrder("C", 3, "delivered")] as any)
    await act(async () => release({}))
    await waitFor(() => expect(fetchOrders).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(statusOf(result, "A")).toBe("cooking"))
  })

  it("a refetch that lands while a write is pending does not wipe the optimistic edit and is applied after it settles", async () => {
    const { result, fetchOrders } = await ready([backendOrder("A", 1)])
    let release!: (v: any) => void
    vi.spyOn(apiClient, "updateOrderStatus").mockImplementation(() => new Promise((res) => (release = res)))

    act(() => result.current.updateOrderStatus("A", "cooking"))
    // SSE reconnect catch-up returns the OLD status while the write is pending.
    act(() => sse.onReconnect!())
    await waitFor(() => expect(fetchOrders).toHaveBeenCalledTimes(2))
    await act(() => new Promise((r) => setTimeout(r, 30)))
    expect(statusOf(result, "A")).toBe("cooking")

    fetchOrders.mockImplementation(async () => [backendOrder("A", 1, "cooking")] as any)
    await act(async () => release({}))
    await waitFor(() => expect(fetchOrders).toHaveBeenCalledTimes(3))
    await waitFor(() => expect(statusOf(result, "A")).toBe("cooking"))
  })

  it("rolls back a failed order update, delete and customer update", async () => {
    const { result } = await ready([backendOrder("A", 1)])
    vi.spyOn(apiClient, "updateOrder").mockRejectedValue(new Error("boom"))
    vi.spyOn(apiClient, "deleteOrder").mockRejectedValue(new Error("boom"))
    vi.spyOn(apiClient, "updateCustomer").mockRejectedValue(new Error("boom"))

    await act(async () => {
      await result.current.updateOrder("A", { comentario: "nuevo" })
    })
    expect(result.current.orders[0].comentario).toBeUndefined()

    await act(async () => {
      await result.current.deleteOrder("A")
    })
    expect(result.current.orders.map((o) => o.id)).toEqual(["A"])
    expect(toast.error).toHaveBeenCalledTimes(2)
  })

  it("rolls back a failed write immediately while the browser reports offline", async () => {
    const { result } = await ready([backendOrder("A", 1)], createQueryClient())
    vi.spyOn(apiClient, "updateOrderStatus").mockRejectedValue(new Error("network down"))

    onlineManager.setOnline(false)
    try {
      act(() => result.current.updateOrderStatus("A", "cooking"))
      await waitFor(() => expect(toast.error).toHaveBeenCalled())
      expect(statusOf(result, "A")).toBe("pending")
    } finally {
      onlineManager.setOnline(true)
    }
  })

  it("anonymous checkout keeps an offline sale pending and never requests private endpoints", async () => {
    vi.mocked(apiClient.hasToken).mockReturnValue(false)
    const fetchOrders = vi.spyOn(apiClient, "fetchOrders").mockResolvedValue([] as any)
    vi.spyOn(apiClient, "createOrder").mockRejectedValue(new TypeError("Failed to fetch"))
    const { wrapper } = setup()
    const { result } = renderHook(() => useOrders(), { wrapper })

    let placed!: ReturnType<typeof result.current.addOrder>
    act(() => {
      placed = result.current.addOrder({
        customer: { nombre: "Anon", telefono: "3001112222", direccion: "Calle 1", barrio: "Centro" },
        items: [],
        total: 10000,
        deliveryFee: 0,
        finalTotal: 10000,
        metodo: "Efectivo",
        status: "pending",
      } as any)
    })
    const server = await placed.serverPromise
    expect(server?.offline).toBe(true)
    await waitFor(() => expect(result.current.orders[0].pendingSync).toBe(true))
    expect(fetchOrders).not.toHaveBeenCalled()
  })
})
