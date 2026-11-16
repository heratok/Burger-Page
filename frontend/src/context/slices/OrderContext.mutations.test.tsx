import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query"
import { seedBlankActiveTenant } from "@/test/fixtures"
import { createTestQueryClient } from "@/test/testQueryClient"
import { keys } from "@/core/query/keys"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

import { toast } from "sonner"
import { TenantProvider } from "./TenantContext"
import { UiProvider } from "./UiContext"
import { OrderProvider, useOrders } from "./OrderContext"
import { ORDER_WRITES_KEY, type OrderBoard } from "./orderBoard"
import { buildCreateOrderInput } from "./OrderContext"
import { apiClient } from "@/core/api/apiClient"
import type { Order, RestaurantRecord } from "@/types/restaurant"

const TENANT = "rest-burger-craft"
const BOARD_KEY = keys.orders(TENANT, "guest")

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

async function ready(client: QueryClient = createTestQueryClient()) {
  vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
  vi.spyOn(apiClient, "subscribeToOrderStream").mockImplementation(() => () => {})
  const fetchOrders = vi
    .spyOn(apiClient, "fetchOrders")
    .mockImplementation(async () => [backendOrder("A", 1), backendOrder("B", 2)] as any)
  vi.spyOn(apiClient, "fetchCustomers").mockResolvedValue([{ id: "c1", name: "Cust", phone: "3000001" }] as any)
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>
      <TenantProvider>
        <UiProvider>
          <OrderProvider>{children}</OrderProvider>
        </UiProvider>
      </TenantProvider>
    </QueryClientProvider>
  )
  const hook = renderHook(() => useOrders(), { wrapper })
  await waitFor(() => expect(hook.result.current.orders).toHaveLength(2))
  return { ...hook, client, fetchOrders }
}

const cachedBoard = (client: QueryClient) => client.getQueryData<OrderBoard>(BOARD_KEY)!
const pendingWrite = (client: QueryClient) =>
  client.getMutationCache().findAll({ mutationKey: ORDER_WRITES_KEY, status: "pending" })[0]

describe("OrderContext edits are optimistic mutations on the query cache", () => {
  beforeEach(() => {
    localStorage.clear()
    seedBlankActiveTenant()
    vi.restoreAllMocks()
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
    vi.mocked(toast.info).mockClear()
  })

  it("onMutate cancels in-flight board reads before applying the optimistic status", async () => {
    const { result, client } = await ready()
    const cancelSpy = vi.spyOn(client, "cancelQueries")
    vi.spyOn(apiClient, "updateOrderStatus").mockImplementation(() => new Promise(() => {}))

    act(() => result.current.updateOrderStatus("A", "cooking"))

    expect(cancelSpy).toHaveBeenCalledWith({ queryKey: BOARD_KEY })
    expect(cachedBoard(client).orders.find((o) => o.id === "A")?.status).toBe("cooking")
  })

  it("keeps the pre-write board as the mutation context while the edit is pending", async () => {
    const { result, client } = await ready()
    const before = cachedBoard(client)
    vi.spyOn(apiClient, "updateOrder").mockImplementation(() => new Promise(() => {}))

    act(() => {
      void result.current.updateOrder("A", { comentario: "sin cebolla" })
    })

    await waitFor(() => expect(pendingWrite(client)).toBeDefined())
    expect((pendingWrite(client).state.context as { snapshot: OrderBoard }).snapshot).toBe(before)
    expect(cachedBoard(client).orders.find((o) => o.id === "A")?.comentario).toBe("sin cebolla")
  })

  it("onError restores the cached snapshot and shows the error toast", async () => {
    const { result, client } = await ready()
    const before = cachedBoard(client)
    vi.spyOn(apiClient, "deleteOrder").mockRejectedValue(new Error("boom"))

    await act(async () => {
      await result.current.deleteOrder("A")
    })

    // Every order object of the snapshot is back (structural sharing may
    // rebuild the array itself).
    const restored = cachedBoard(client).orders
    expect(restored).toHaveLength(before.orders.length)
    restored.forEach((order, i) => expect(order).toBe(before.orders[i]))
    expect(toast.success).toHaveBeenCalledWith("Orden eliminada")
    expect(toast.error).toHaveBeenCalledWith("No se pudo eliminar la orden del servidor")
  })

  it("buildCreateOrderInput forwards orderType when set and omits it when undefined", () => {
    const restaurant = {
      id: TENANT,
      slug: "burger-craft",
      config: {} as any,
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      products: [{ id: "prod-1", name: "Burger", price: 20000, category: "Burgers", src: "", description: "", inStock: true }],
      additions: [],
      customers: [],
    } as RestaurantRecord

    const baseOrder: Order = {
      id: "ord-temp-1",
      orderNumber: 500,
      customer: { nombre: "Ana", telefono: "3001234567", direccion: "", barrio: "" },
      items: [{ id: "prod-1", name: "Burger", price: 20000, cantidad: 1, total: 20000 }],
      total: 20000,
      deliveryFee: 0,
      finalTotal: 20000,
      metodo: "Efectivo",
      status: "pending",
      createdAt: "2026-11-15T00:00:00.000Z",
      updatedAt: "2026-11-15T00:00:00.000Z",
    }

    const withPickup = buildCreateOrderInput(restaurant, { ...baseOrder, orderType: "recoger" })
    expect(withPickup.orderType).toBe("recoger")

    const withoutOrderType = buildCreateOrderInput(restaurant, baseOrder)
    expect("orderType" in withoutOrderType).toBe(false)
  })

  it("addOrder forwards orderType 'recoger' to apiClient.createOrder and preserves it on the local and adopted order", async () => {
    const { result, client } = await ready()
    const createSpy = vi.spyOn(apiClient, "createOrder").mockResolvedValue({
      id: "srv-pickup-1",
      orderNumber: 9001,
      orderType: "recoger",
      status: "pending",
    } as any)

    let placed: ReturnType<typeof result.current.addOrder> | undefined
    act(() => {
      placed = result.current.addOrder({
        orderType: "recoger",
        customer: { nombre: "Luis", telefono: "3005556677", direccion: "", barrio: "" },
        items: [{ id: "prod-1", name: "Burger", price: 20000, cantidad: 1, total: 20000 }],
        total: 20000,
        deliveryFee: 0,
        finalTotal: 20000,
        metodo: "Transferencia",
        status: "pending",
      })
    })

    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ orderType: "recoger" }))
    expect(placed?.orderType).toBe("recoger")

    await act(async () => {
      await placed?.serverPromise
    })

    const adopted = cachedBoard(client).orders.find((o) => o.id === "srv-pickup-1")
    expect(adopted?.orderType).toBe("recoger")
  })
})
