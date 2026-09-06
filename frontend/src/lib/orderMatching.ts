import type { Order } from "@/types/restaurant"

/**
 * Resolves the order that should populate the modal given the user's `selectedOrder`
 * (which may hold a stale optimistic id) and the current `orders` array.
 *
 * Returns the matched order when `find()` finds one whose `orderNumber` and customer
 * name agree with `selectedOrder`; otherwise returns `selectedOrder` itself and
 * logs a warning. This is the structural defense against the optimistic-id swap
 * race documented in the order-id-collision-fix proposal.
 */
export function resolveModalOrder(
  orders: Order[],
  selectedOrder: Order | null
): Order | null {
  if (!selectedOrder) return null

  const found = orders.find((o) => o.id === selectedOrder.id)
  if (
    found &&
    found.orderNumber === selectedOrder.orderNumber &&
    found.customer?.nombre === selectedOrder.customer?.nombre
  ) {
    return found
  }

  if (found) {
    console.warn(
      "[OrdersKanban] order id collision detected; falling back to selectedOrder",
      {
        selectedId: selectedOrder.id,
        selectedOrderNumber: selectedOrder.orderNumber,
        foundId: found.id,
        foundOrderNumber: found.orderNumber,
      }
    )
  }

  return selectedOrder
}
