import type { Order } from "@/types/restaurant"
import { type StorageAdapter, LocalStorageAdapter } from "./StorageAdapter"

export const PENDING_ORDERS_KEY = "burger_page_pending_orders_v1"

type QueueState = Record<string, Order[]>

const EMPTY: Order[] = []

/**
 * Offline sales (REJ-02) that never reached the server, persisted per tenant
 * so they survive a reload until the retry syncs or the server rejects them.
 * This is the only order data the app persists: everything else is server
 * state in the query cache. One storage key holds every tenant's list, so a
 * logout purges them all at once.
 *
 * Snapshots are stable (same array until that tenant's list changes), which
 * makes list() usable as a useSyncExternalStore snapshot.
 */
export class PendingOrdersQueue {
  private adapter: StorageAdapter
  private raw: string | null | undefined = undefined
  private state: QueueState = {}
  private listeners = new Set<() => void>()

  constructor(adapter: StorageAdapter = new LocalStorageAdapter()) {
    this.adapter = adapter
  }

  /** The tenant's queued sales, newest first. */
  list(tenantId: string | undefined): Order[] {
    if (!tenantId) return EMPTY
    return this.read()[tenantId] ?? EMPTY
  }

  /** Queues a sale (once per id), newest first. */
  add(tenantId: string, order: Order): void {
    const current = this.list(tenantId)
    if (current.some((o) => o.id === order.id)) return
    this.write(tenantId, [toStored(order), ...current])
  }

  remove(tenantId: string, orderId: string): void {
    const current = this.list(tenantId)
    if (!current.some((o) => o.id === orderId)) return
    this.write(tenantId, current.filter((o) => o.id !== orderId))
  }

  /** Replaces the tenant's list (used to apply an edit to queued sales). */
  replace(tenantId: string, orders: Order[]): void {
    this.write(tenantId, orders.map(toStored))
  }

  /** Drops every tenant's queue (session end). */
  purge(): void {
    this.adapter.removeItem(PENDING_ORDERS_KEY)
    this.raw = undefined
    this.state = {}
    this.notify()
  }

  /** Change listener; also fires when another tab changes the queue. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    const onStorage = (e: StorageEvent) => {
      if (e.key === PENDING_ORDERS_KEY || e.key === null) listener()
    }
    if (typeof window !== "undefined") window.addEventListener("storage", onStorage)
    return () => {
      this.listeners.delete(listener)
      if (typeof window !== "undefined") window.removeEventListener("storage", onStorage)
    }
  }

  /** Re-parses only when the stored value changed (another tab, a reload, a test reset). */
  private read(): QueueState {
    const raw = this.adapter.getItem(PENDING_ORDERS_KEY)
    if (raw !== this.raw) {
      this.raw = raw
      this.state = parse(raw)
    }
    return this.state
  }

  private write(tenantId: string, orders: Order[]): void {
    const next: QueueState = { ...this.read() }
    if (orders.length > 0) next[tenantId] = orders
    else delete next[tenantId]
    const raw = Object.keys(next).length > 0 ? JSON.stringify(next) : null
    if (raw === null) this.adapter.removeItem(PENDING_ORDERS_KEY)
    else this.adapter.setItem(PENDING_ORDERS_KEY, raw)
    this.raw = raw
    this.state = next
    this.notify()
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener())
  }
}

/** A queued sale is plain data: the in-memory server promise is never stored. */
function toStored(order: Order): Order {
  const { serverPromise: _inMemoryOnly, ...stored } = order as Order & { serverPromise?: unknown }
  return { ...stored, pendingSync: true }
}

function parse(raw: string | null): QueueState {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as QueueState) : {}
  } catch {
    return {}
  }
}

/** App-wide queue (localStorage). */
export const pendingOrdersQueue = new PendingOrdersQueue()
