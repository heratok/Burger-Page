import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import React from "react"
import { renderHook, act } from "@testing-library/react"
import type { Order } from "@/types/restaurant"
import { TenantProvider } from "@/context/slices/TenantContext"
import { UiProvider } from "@/context/slices/UiContext"
import {
  OrderProvider,
  useOrders,
  isNetworkFailure,
  PENDING_RETRY_BASE_MS,
  MAX_PENDING_RETRY_ATTEMPTS,
} from "@/context/slices/OrderContext"

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(
    TenantProvider,
    null,
    React.createElement(UiProvider, null, React.createElement(OrderProvider, null, children))
  )

function saleParams(): Omit<Order, "id" | "orderNumber" | "createdAt" | "updatedAt"> {
  return {
    customer: { nombre: "Robust Tester", telefono: "3001110000", direccion: "Calle 1", barrio: "Centro" },
    items: [{ id: "i1", name: "Burger", price: 20000, cantidad: 1, total: 20000, adiciones: [] }],
    total: 20000,
    deliveryFee: 0,
    finalTotal: 20000,
    metodo: "Efectivo",
    status: "pending",
  }
}

const httpError = (status: number, message = `API Error: ${status}`) =>
  Object.assign(new Error(message), { status })

describe("isNetworkFailure — retryable submission failures (2.2)", () => {
  it.each([500, 502, 503, 504, 408])("treats HTTP %s as retryable (server may have committed)", (status) => {
    expect(isNetworkFailure(httpError(status))).toBe(true)
  })

  it.each([400, 401, 404, 409, 422])("keeps HTTP %s as a rejection", (status) => {
    expect(isNetworkFailure(httpError(status, "Subtotal below minimum"))).toBe(false)
  })

  it("treats client-side abort/timeout as retryable", () => {
    expect(isNetworkFailure(Object.assign(new Error("aborted"), { name: "AbortError" }))).toBe(true)
    expect(isNetworkFailure(Object.assign(new Error("timeout"), { name: "TimeoutError" }))).toBe(true)
  })

  it("still treats fetch TypeError as retryable", () => {
    expect(isNetworkFailure(new TypeError("Failed to fetch"))).toBe(true)
  })
})

describe("addOrder / pending retry (2.2, 2.3)", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  async function setup(hasToken: boolean) {
    const { apiClient } = await import("@/core/api/apiClient")
    const { toast } = await import("sonner")
    vi.spyOn(apiClient, "subscribeToOrderStream").mockImplementation(() => () => {})
    vi.spyOn(apiClient, "hasToken").mockReturnValue(hasToken)
    vi.spyOn(apiClient, "fetchOrders").mockResolvedValue([])
    vi.spyOn(apiClient, "fetchCustomers").mockResolvedValue([])
    const errorSpy = vi.spyOn(toast, "error")
    const warningSpy = vi.spyOn(toast, "warning")
    return { apiClient, errorSpy, warningSpy }
  }

  async function flush() {
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
  }

  it("keeps the sale pending (no rejection) on a 503 after submit, resolving the checkout as offline", async () => {
    const { apiClient, errorSpy } = await setup(false)
    vi.spyOn(apiClient, "createOrder").mockRejectedValue(httpError(503))
    const { result } = renderHook(() => useOrders(), { wrapper })
    await flush()

    let placed: any
    await act(async () => {
      placed = result.current.addOrder(saleParams())
      await Promise.resolve()
    })
    const sync = await placed.serverPromise

    expect(sync.offline).toBe(true)
    expect(errorSpy).not.toHaveBeenCalled()
    expect(result.current.orders).toHaveLength(1)
    expect(result.current.orders[0].pendingSync).toBe(true)
  })

  it("still rejects and removes the card on a 4xx with the server reason", async () => {
    const { apiClient, errorSpy } = await setup(false)
    vi.spyOn(apiClient, "createOrder").mockRejectedValue(httpError(400, "Subtotal 5000 is below minimum order amount 20000"))
    const { result } = renderHook(() => useOrders(), { wrapper })
    await flush()
    await act(async () => {
      result.current.addOrder(saleParams())
      await Promise.resolve()
    })
    await flush()
    expect(result.current.orders).toHaveLength(0)
    expect(errorSpy).toHaveBeenCalledWith(expect.any(String), {
      description: "Subtotal 5000 is below minimum order amount 20000",
    })
  })

  it("retries an anonymous pending order with the SAME clientOrderId and clears pendingSync", async () => {
    const { apiClient } = await setup(false)
    const createSpy = vi
      .spyOn(apiClient, "createOrder")
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue({ id: "server-anon-1", orderNumber: 77, status: "pending" } as any)
    const { result } = renderHook(() => useOrders(), { wrapper })
    await flush()

    await act(async () => {
      result.current.addOrder(saleParams())
      await Promise.resolve()
    })
    await flush()
    expect(result.current.orders[0].pendingSync).toBe(true)
    expect(createSpy).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PENDING_RETRY_BASE_MS + 1)
    })
    await flush()

    expect(createSpy).toHaveBeenCalledTimes(2)
    const first = createSpy.mock.calls[0][0] as any
    const retry = createSpy.mock.calls[1][0] as any
    expect(retry.clientOrderId).toBe(first.clientOrderId)
    expect(result.current.orders).toHaveLength(1)
    expect(result.current.orders[0].id).toBe("server-anon-1")
    expect(result.current.orders[0].pendingSync).toBeFalsy()
  })

  it("stops retrying and informs the user when the retry is rejected with a 4xx", async () => {
    const { apiClient, errorSpy } = await setup(false)
    const createSpy = vi
      .spyOn(apiClient, "createOrder")
      .mockRejectedValueOnce(httpError(503))
      .mockRejectedValue(httpError(400, "Product Burger is not available"))
    const { result } = renderHook(() => useOrders(), { wrapper })
    await flush()
    await act(async () => {
      result.current.addOrder(saleParams())
      await Promise.resolve()
    })
    await flush()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PENDING_RETRY_BASE_MS + 1)
    })
    await flush()
    expect(createSpy).toHaveBeenCalledTimes(2)
    expect(result.current.orders).toHaveLength(0)
    expect(errorSpy).toHaveBeenCalledWith(expect.any(String), {
      description: "Product Burger is not available",
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60_000)
    })
    expect(createSpy).toHaveBeenCalledTimes(2)
  })

  it("bounds automatic retries when the server keeps failing (no infinite loop) and tells the user", async () => {
    const { apiClient, warningSpy } = await setup(false)
    const createSpy = vi.spyOn(apiClient, "createOrder").mockRejectedValue(httpError(503))
    const { result } = renderHook(() => useOrders(), { wrapper })
    await flush()
    await act(async () => {
      result.current.addOrder(saleParams())
      await Promise.resolve()
    })
    await flush()

    for (let i = 0; i < MAX_PENDING_RETRY_ATTEMPTS + 5; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10 * 60_000)
      })
    }

    // 1 original attempt + at most MAX automatic retries.
    expect(createSpy.mock.calls.length).toBe(1 + MAX_PENDING_RETRY_ATTEMPTS)
    // The order is kept (never silently dropped) and the user was told once.
    expect(result.current.orders).toHaveLength(1)
    expect(result.current.orders[0].pendingSync).toBe(true)
    const giveUpWarnings = warningSpy.mock.calls.filter((c) => String(c[0]).includes("No se pudo sincronizar"))
    expect(giveUpWarnings).toHaveLength(1)
  })
})
