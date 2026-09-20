import { describe, it, expect, vi, beforeEach } from "vitest"
import React from "react"
import { renderHook, act } from "@testing-library/react"
import type { RestaurantRecord, Order } from "@/types/restaurant"
import { createOrderSchema } from "@burger-page/contracts"
import { TenantProvider } from "@/context/slices/TenantContext"
import { UiProvider } from "@/context/slices/UiContext"
import {
  OrderProvider,
  useOrders,
  buildCreateOrderInput,
} from "@/context/slices/OrderContext"
import { DEFAULT_STORE_CONFIG } from "@/constants/themePresets"

// Type helper: the clientOrderId rides on the optimistic Order object
// (SUS-19). It is intentionally not part of the shared Order interface.
type OrderWithClientId = Order & { clientOrderId?: string }

function createMockRestaurant(orders: Order[] = []): RestaurantRecord {
  return {
    id: "rest-burger-craft",
    slug: "burger-craft",
    adminPassword: "craft",
    isActive: true,
    createdAt: "2026-08-01T12:00:00.000Z",
    config: DEFAULT_STORE_CONFIG,
    products: [],
    additions: [],
    orders,
    customers: [],
  }
}

function createOrderParams(): Omit<Order, "id" | "orderNumber" | "createdAt" | "updatedAt"> {
  return {
    customer: { nombre: "Idempotent Tester", telefono: "3007776655", direccion: "Calle 9", barrio: "Norte" },
    items: [{ id: "i1", name: "Burger", price: 20000, cantidad: 1, total: 20000, adiciones: [] }],
    total: 20000,
    deliveryFee: 0,
    finalTotal: 20000,
    metodo: "Efectivo",
    status: "pending",
  }
}

// .ts file (no JSX): build the provider tree with createElement.
// eslint-disable-next-line react/react-in-jsx-scope
const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(
    TenantProvider,
    null,
    React.createElement(UiProvider, null, React.createElement(OrderProvider, null, children))
  )

describe("createOrderSchema — clientOrderId (SUS-19)", () => {
  const base = {
    restaurantId: "rest-burger-craft",
    items: [{ productId: "prod-1", quantity: 1 }],
  }

  it("accepts an optional clientOrderId string (idempotency correlation)", () => {
    const parsed = createOrderSchema.safeParse({ ...base, clientOrderId: "cli-attempt-1" })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.clientOrderId).toBe("cli-attempt-1")
    }
  })

  it("omits clientOrderId when absent (legacy callers unaffected)", () => {
    const parsed = createOrderSchema.safeParse(base)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.clientOrderId).toBeUndefined()
    }
  })

  it("rejects a non-string clientOrderId", () => {
    expect(createOrderSchema.safeParse({ ...base, clientOrderId: 42 }).success).toBe(false)
  })

  it("rejects an empty clientOrderId", () => {
    expect(createOrderSchema.safeParse({ ...base, clientOrderId: "" }).success).toBe(false)
  })
})

describe("buildCreateOrderInput — clientOrderId (SUS-19)", () => {
  const fullOrder = (extra: Partial<OrderWithClientId> = {}): any => ({
    ...createOrderParams(),
    id: "ord-input",
    orderNumber: 42,
    createdAt: "2026-08-01T14:00:00.000Z",
    updatedAt: "2026-08-01T14:00:00.000Z",
    ...extra,
  })

  it("includes clientOrderId on the create input when the order carries one", () => {
    const input = buildCreateOrderInput(
      createMockRestaurant([]),
      fullOrder({ clientOrderId: "cli-input-1" })
    )
    expect(input.clientOrderId).toBe("cli-input-1")
  })

  it("omits clientOrderId when the order has none (legacy flows unaffected)", () => {
    const input = buildCreateOrderInput(createMockRestaurant([]), fullOrder())
    expect(input.clientOrderId).toBeUndefined()
  })
})

describe("addOrder — one clientOrderId per sale attempt (SUS-19)", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("dedupes a double invocation of the same sale: one card, one createOrder call, same clientOrderId", async () => {
    const { apiClient } = await import("@/core/api/apiClient")
    const createSpy = vi.spyOn(apiClient, "createOrder").mockResolvedValue({
      id: "server-sus19-1",
      orderNumber: 1111,
      status: "pending",
      createdAt: "2026-08-01T14:00:00.000Z",
      updatedAt: "2026-08-01T14:00:00.000Z",
    } as any)
    vi.spyOn(apiClient, "subscribeToOrderStream").mockImplementation(() => () => {})
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    vi.spyOn(apiClient, "fetchOrders").mockResolvedValue([])
    vi.spyOn(apiClient, "fetchCustomers").mockResolvedValue([])

    const { result } = renderHook(() => useOrders(), { wrapper })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    const attempt = createOrderParams()
    act(() => {
      result.current.addOrder(attempt)
      result.current.addOrder(attempt) // the double-click re-trigger of the same sale
    })

    // ONE optimistic card and ONE createOrder call for the same sale.
    expect(result.current.orders).toHaveLength(1)
    expect(createSpy).toHaveBeenCalledTimes(1)
    const input = createSpy.mock.calls[0][0] as any
    expect(typeof input.clientOrderId).toBe("string")
    expect(input.clientOrderId.length).toBeGreaterThan(0)
    // The stored optimistic order carries the very same correlation id.
    expect((result.current.orders[0] as any).clientOrderId).toBe(input.clientOrderId)
  })

  it("reuses the same clientOrderId when an offline sale is retried (lost-response retry)", async () => {
    const { apiClient } = await import("@/core/api/apiClient")
    const createSpy = vi
      .spyOn(apiClient, "createOrder")
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue({ id: "server-sus19-2", orderNumber: 2222, status: "pending" } as any)
    vi.spyOn(apiClient, "subscribeToOrderStream").mockImplementation(() => () => {})
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    vi.spyOn(apiClient, "fetchOrders").mockResolvedValue([])
    vi.spyOn(apiClient, "fetchCustomers").mockResolvedValue([])

    const { result } = renderHook(() => useOrders(), { wrapper })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    // First attempt is lost offline: the sale stays pending with its id.
    await act(async () => {
      result.current.addOrder(createOrderParams())
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(result.current.orders[0].pendingSync).toBe(true)
    const firstInput = createSpy.mock.calls[0][0] as any
    expect(typeof firstInput.clientOrderId).toBe("string")

    // The automatic retry after a successful refresh re-sends the SAME id:
    // the backend replays the existing order instead of duplicating the sale.
    await act(async () => {
      await result.current.refreshOrders()
    })
    expect(createSpy).toHaveBeenCalledTimes(2)
    const retryInput = createSpy.mock.calls[1][0] as any
    expect(retryInput.clientOrderId).toBe(firstInput.clientOrderId)
  })

  it("does not merge two distinct sales placed back-to-back (different payloads, different ids)", async () => {
    const { apiClient } = await import("@/core/api/apiClient")
    const createSpy = vi.spyOn(apiClient, "createOrder").mockResolvedValue({
      id: "server-sus19-3",
      orderNumber: 3333,
      status: "pending",
      createdAt: "2026-08-01T14:00:00.000Z",
      updatedAt: "2026-08-01T14:00:00.000Z",
    } as any)
    vi.spyOn(apiClient, "subscribeToOrderStream").mockImplementation(() => () => {})
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
    vi.spyOn(apiClient, "fetchOrders").mockResolvedValue([])
    vi.spyOn(apiClient, "fetchCustomers").mockResolvedValue([])

    const { result } = renderHook(() => useOrders(), { wrapper })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    const saleA = createOrderParams()
    const saleB = {
      ...createOrderParams(),
      customer: { ...createOrderParams().customer, nombre: "Second Customer" },
    }
    act(() => {
      result.current.addOrder(saleA)
      result.current.addOrder(saleB) // different sale, different payload
    })

    // Two distinct sales within the same tick stay distinct: two cards, two
    // createOrder calls, and different correlation ids.
    expect(result.current.orders).toHaveLength(2)
    expect(createSpy).toHaveBeenCalledTimes(2)
    const ids = new Set(
      createSpy.mock.calls.map((c: any[]) => (c[0] as any).clientOrderId)
    )
    expect(ids.size).toBe(2)
  })
})