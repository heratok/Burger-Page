import { describe, it, expect, vi, beforeEach } from "vitest"
import type { Order } from "@/types/restaurant"
import { InMemoryStorageAdapter } from "./StorageAdapter"
import { PendingOrdersQueue, PENDING_ORDERS_KEY } from "./pendingOrdersQueue"

const order = (id: string, extra: Partial<Order> = {}): Order => ({
  id,
  orderNumber: 100,
  customer: { nombre: "Offline", telefono: "300", direccion: "x", barrio: "y" },
  items: [],
  total: 1000,
  deliveryFee: 0,
  finalTotal: 1000,
  metodo: "Efectivo",
  status: "pending",
  createdAt: "2026-08-01T12:00:00.000Z",
  updatedAt: "2026-08-01T12:00:00.000Z",
  pendingSync: true,
  ...extra,
})

describe("PendingOrdersQueue", () => {
  let adapter: InMemoryStorageAdapter
  let queue: PendingOrdersQueue

  beforeEach(() => {
    adapter = new InMemoryStorageAdapter()
    queue = new PendingOrdersQueue(adapter)
  })

  it("keeps queued sales per tenant, newest first", () => {
    queue.add("t1", order("a"))
    queue.add("t1", order("b"))
    queue.add("t2", order("c"))

    expect(queue.list("t1").map((o) => o.id)).toEqual(["b", "a"])
    expect(queue.list("t2").map((o) => o.id)).toEqual(["c"])
    expect(queue.list("t3")).toEqual([])
  })

  it("persists across instances (a reload) and never stores the in-memory server promise", () => {
    queue.add("t1", { ...order("a", { clientOrderId: "cli-1" } as any), serverPromise: Promise.resolve() } as any)

    const reloaded = new PendingOrdersQueue(adapter)
    const [restored] = reloaded.list("t1") as any[]
    expect(restored.id).toBe("a")
    expect(restored.clientOrderId).toBe("cli-1")
    expect(restored.pendingSync).toBe(true)
    expect("serverPromise" in restored).toBe(false)
  })

  it("does not queue the same sale twice", () => {
    queue.add("t1", order("a"))
    queue.add("t1", order("a"))
    expect(queue.list("t1")).toHaveLength(1)
  })

  it("removes a sale and replaces a tenant's list", () => {
    queue.add("t1", order("a"))
    queue.add("t1", order("b"))
    queue.remove("t1", "a")
    expect(queue.list("t1").map((o) => o.id)).toEqual(["b"])

    queue.replace("t1", [order("b", { status: "cooking" })])
    expect(queue.list("t1")[0].status).toBe("cooking")
  })

  it("returns the same snapshot until the queue changes", () => {
    queue.add("t1", order("a"))
    const first = queue.list("t1")
    expect(queue.list("t1")).toBe(first)
    expect(queue.list("missing")).toBe(queue.list("other-missing"))

    queue.add("t1", order("b"))
    expect(queue.list("t1")).not.toBe(first)
  })

  it("notifies subscribers on every change", () => {
    const listener = vi.fn()
    const unsubscribe = queue.subscribe(listener)
    queue.add("t1", order("a"))
    queue.remove("t1", "a")
    unsubscribe()
    queue.add("t1", order("b"))
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it("notifies subscribers when another tab changes the queue", () => {
    const listener = vi.fn()
    const unsubscribe = queue.subscribe(listener)
    window.dispatchEvent(new StorageEvent("storage", { key: PENDING_ORDERS_KEY }))
    window.dispatchEvent(new StorageEvent("storage", { key: "unrelated" }))
    unsubscribe()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it("purges every tenant's queue at once (logout)", () => {
    queue.add("t1", order("a"))
    queue.add("t2", order("b"))
    queue.purge()
    expect(adapter.getItem(PENDING_ORDERS_KEY)).toBeNull()
    expect(queue.list("t1")).toEqual([])
    expect(queue.list("t2")).toEqual([])
  })

  it("survives a corrupt stored value", () => {
    adapter.setItem(PENDING_ORDERS_KEY, "{not json")
    expect(queue.list("t1")).toEqual([])
    queue.add("t1", order("a"))
    expect(queue.list("t1").map((o) => o.id)).toEqual(["a"])
  })
})
