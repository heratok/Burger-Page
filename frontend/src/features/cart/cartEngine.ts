import type { MenuItem, OrderItem } from "@/types/restaurant"

export interface CartAddition {
  id?: string
  name: string
  price: number
  cantidad: number
  src?: string
}

export interface CartItem {
  id: string
  menuItemId?: string
  name: string
  price: number
  cantidad: number
  total: number
  src: string
  observacion?: string
  adiciones: CartAddition[]
}

export interface CartSummary {
  subtotal: number
  totalItems: number
  deliveryFee: number
  total: number
}

/**
 * Calculates the total for a single cart line item including its additions.
 */
export function calculateLineItemTotal(item: {
  price: number
  cantidad: number
  adiciones?: Array<{ price: number; cantidad: number }>
}): number {
  const quantity = Math.max(1, item.cantidad || 1)
  const baseTotal = item.price * quantity
  const additionsTotal = (item.adiciones ?? []).reduce(
    (acc, add) => acc + (add.price || 0) * (add.cantidad || 0),
    0
  )
  return baseTotal + additionsTotal
}

/**
 * Computes subtotal, item counts, and grand total for a cart.
 */
export function calculateCartSummary(
  items: CartItem[],
  deliveryFee = 0
): CartSummary {
  const subtotal = items.reduce((acc, item) => acc + item.total, 0)
  const totalItems = items.reduce((acc, item) => acc + item.cantidad, 0)
  const total = subtotal + (items.length > 0 ? deliveryFee : 0)

  return {
    subtotal,
    totalItems,
    deliveryFee: items.length > 0 ? deliveryFee : 0,
    total,
  }
}

/**
 * Factory helper to construct a CartItem from a MenuItem and selected additions.
 */
export function createCartItem({
  product,
  cantidad = 1,
  adiciones = [],
  observacion = "",
  customId,
}: {
  product: MenuItem
  cantidad?: number
  adiciones?: CartAddition[]
  observacion?: string
  customId?: string
}): CartItem {
  const activeAdditions = adiciones.filter((a) => a.cantidad > 0)
  const total = calculateLineItemTotal({
    price: product.price,
    cantidad,
    adiciones: activeAdditions,
  })

  return {
    id: customId || `cart_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    menuItemId: product.id,
    name: product.name,
    price: product.price,
    cantidad,
    total,
    src: product.src,
    observacion: observacion.trim(),
    adiciones: activeAdditions,
  }
}

/**
 * Converts a CartItem to the OrderItem format required by the Order domain.
 */
export function cartItemToOrderItem(cartItem: CartItem): OrderItem {
  return {
    id: cartItem.id,
    name: cartItem.name,
    price: cartItem.price,
    cantidad: cartItem.cantidad,
    total: cartItem.total,
    src: cartItem.src,
    observacion: cartItem.observacion,
    adiciones: cartItem.adiciones.map((a) => ({
      name: a.name,
      price: a.price,
      cantidad: a.cantidad,
    })),
  }
}
