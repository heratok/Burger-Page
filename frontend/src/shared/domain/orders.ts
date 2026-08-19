import type { OrderStatus } from "./domain"

/**
 * Allowed order status transitions (design contract):
 * new → confirmed|cancelled; confirmed → delivered|cancelled;
 * delivered and cancelled are terminal.
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ["confirmed", "cancelled"],
  confirmed: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}

const ORDER_ID_MIN = 100000
const ORDER_ID_MAX = 999999
const ID_RETRY_ATTEMPTS = 10

function randomOrderId(): number {
  return Math.floor(ORDER_ID_MIN + Math.random() * (ORDER_ID_MAX - ORDER_ID_MIN + 1))
}

/**
 * Creates a unique 6-digit order id (100000–999999).
 * Tries random picks first (retrying on collision), then falls back to the
 * lowest free id when retries are exhausted.
 */
export function createUniqueOrderId(existing: Set<number>): number {
  for (let attempt = 0; attempt < ID_RETRY_ATTEMPTS; attempt++) {
    const id = randomOrderId()
    if (!existing.has(id)) return id
  }
  for (let id = ORDER_ID_MIN; id <= ORDER_ID_MAX; id++) {
    if (!existing.has(id)) return id
  }
  throw new Error("No free order ids available")
}