import type { Order } from "@/types/restaurant"

const SALON_PREFIX = /^sal[oó]n\s*-\s*/i
const GENERIC_SALON_TABLE = /^mesa\s+general$/i

/**
 * Orders created before tables existed encoded the table in the customer
 * address ("Salón - Mesa 8") or name ("Mesa 8"). Returns that text, or
 * undefined when the order has no usable table text.
 */
export function parseLegacyTableLabel(direccion: string, nombre: string): string | undefined {
  const fromAddress = SALON_PREFIX.test(direccion) ? direccion.replace(SALON_PREFIX, "").trim() : ""
  if (fromAddress && !GENERIC_SALON_TABLE.test(fromAddress)) return fromAddress
  const name = nombre.trim()
  if (/^mesa\s+\S/i.test(name) && !GENERIC_SALON_TABLE.test(name) && !/^mesa\s+sal[oó]n$/i.test(name)) {
    return name
  }
  return undefined
}

/** The table text to show for an order: the new snapshot first, legacy text otherwise. */
export function getOrderTableLabel(order: Pick<Order, "tableLabel" | "customer">): string | undefined {
  if (order.tableLabel) return order.tableLabel
  return parseLegacyTableLabel(order.customer?.direccion ?? "", order.customer?.nombre ?? "")
}

/** One-line place of an order for cards and details: the salon table or barrio + address. */
export function getOrderLocationText(
  order: Pick<Order, "tableLabel" | "customer">,
  separator = " - "
): string {
  const label = getOrderTableLabel(order)
  if (label) return `Salón · ${label}`
  const { barrio, direccion } = order.customer
  return `${barrio}${separator}${direccion}`
}

export function isOrderOnTable(order: Pick<Order, "tableId">, tableId: string): boolean {
  return Boolean(order.tableId) && order.tableId === tableId
}
