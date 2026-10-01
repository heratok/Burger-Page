import { describe, it, expect, vi, beforeEach } from "vitest"
import { seedBlankActiveTenant } from "@/test/fixtures"
import React from "react"
import { renderHook, act, waitFor } from "@testing-library/react"
import type { OrderEvent } from "@burger-page/contracts"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

import { toast } from "sonner"
import { TenantProvider } from "./TenantContext"
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
  customer: { name: `Cliente ${orderNumber}` },
  ...extra,
})

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <TenantProvider>
    <UiProvider>
      <OrderProvider>{children}</OrderProvider>
    </UiProvider>
  </TenantProvider>
)

let sse: { onEvent?: (e: OrderEvent) => void; onReconnect?: () => void }

async function setup(initial: any[]) {
  sse = {}
  vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
  vi.spyOn(apiClient, "fetchCustomers").mockResolvedValue([])
  const fetchSpy = vi.spyOn(apiClient, "fetchOrders").mockResolvedValue(initial as any)
  vi.spyOn(apiClient, "subscribeToOrderStream").mockImplementation(((onEvent: any, _r?: string, onReconnect?: () => void) => {
    sse.onEvent = onEvent
    sse.onReconnect = onReconnect
    return () => {}
  }) as any)
  const hook = renderHook(() => useOrders(), { wrapper })
  await waitFor(() => expect(hook.result.current.orders.length).toBe(initial.length))
  return { ...hook, fetchSpy }
}

const statusOf = (hook: { result: { current: { orders: any[] } } }, id: string) =>
  hook.result.current.orders.find((o) => o.id === id)?.status

describe("OrderContext rollbacks and SSE catch-up (5.3, 5.6, 5.8)", () => {
  beforeEach(() => {
    localStorage.clear()
    seedBlankActiveTenant()
    vi.restoreAllMocks()
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
    vi.mocked(toast.info).mockClear()
  })

  it("5.3: a failed status change reverts only that order and keeps SSE-added orders and edits", async () => {
    const hook = await setup([backendOrder("A", 1), backendOrder("C", 3)])
    let reject!: (e: Error) => void
    vi.spyOn(apiClient, "updateOrderStatus").mockImplementation(() => new Promise((_, rej) => { reject = rej }))

    act(() => {
      hook.result.current.updateOrderStatus("A", "cooking")
    })
    expect(statusOf(hook, "A")).toBe("cooking")

    // While the request is in flight: SSE adds B and another order changes status.
    act(() => {
      sse.onEvent!({
        eventType: "ORDER_CREATED",
        orderId: "B",
        orderNumber: 2,
        status: "pending",
        timestamp: new Date().toISOString(),
        payload: {
          customer: { nombre: "Nuevo", telefono: "300", direccion: "x", barrio: "y" },
          items: [],
          subtotal: 1,
          deliveryFee: 0,
          finalTotal: 1,
        },
      } as any)
      sse.onEvent!({ eventType: "ORDER_STATUS_UPDATED", orderId: "C", status: "delivered", timestamp: new Date().toISOString() } as any)
    })
    expect(hook.result.current.orders.some((o) => o.id === "B")).toBe(true)

    await act(async () => {
      reject(new Error("rejected"))
    })

    await waitFor(() => expect(statusOf(hook, "A")).toBe("pending"))
    expect(hook.result.current.orders.some((o) => o.id === "B")).toBe(true)
    expect(statusOf(hook, "C")).toBe("delivered")
    expect(toast.error).toHaveBeenCalledTimes(1)
  })

  it("5.6: success toast only after the server accepts the receipt", async () => {
    const hook = await setup([backendOrder("A", 1)])
    let resolve!: (v: any) => void
    vi.spyOn(apiClient, "updateOrderReceipt").mockImplementation(() => new Promise((res) => { resolve = res }))

    let done!: Promise<void>
    act(() => {
      done = hook.result.current.updateOrderReceipt("A", "https://r/1.png")
    })
    expect(toast.success).not.toHaveBeenCalled()

    await act(async () => {
      resolve({})
      await done
    })
    expect(toast.success).toHaveBeenCalledTimes(1)
    expect(hook.result.current.orders.find((o) => o.id === "A")?.receiptUrl).toBe("https://r/1.png")
  })

  it("5.6: a failed receipt rolls back, shows an error, never a success, and rejects", async () => {
    const hook = await setup([backendOrder("A", 1, "pending", { receiptUrl: "https://r/old.png" })])
    vi.spyOn(apiClient, "updateOrderReceipt").mockRejectedValue(new Error("boom"))

    await act(async () => {
      await expect(hook.result.current.updateOrderReceipt("A", "https://r/new.png")).rejects.toThrow("boom")
    })

    expect(hook.result.current.orders.find((o) => o.id === "A")?.receiptUrl).toBe("https://r/old.png")
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(toast.success).not.toHaveBeenCalled()
  })

  it("5.8: SSE reconnect refetches orders and merges the ones created during the drop", async () => {
    const hook = await setup([backendOrder("A", 1)])
    expect(typeof sse.onReconnect).toBe("function")
    const callsBefore = hook.fetchSpy.mock.calls.length

    hook.fetchSpy.mockResolvedValue([backendOrder("A", 1), backendOrder("M", 9)] as any)
    await act(async () => {
      sse.onReconnect!()
    })

    await waitFor(() => expect(hook.result.current.orders.some((o) => o.id === "M")).toBe(true))
    expect(hook.fetchSpy.mock.calls.length).toBe(callsBefore + 1)
  })
})
