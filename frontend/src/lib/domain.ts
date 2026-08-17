/**
 * Domain types for the restaurant CRM (generic storefront model).
 * Replaces the burger-named types previously living in data.ts / whatsapp.ts.
 * Types live with their pure logic (src/lib convention).
 */

export type MetodoPago = "Efectivo" | "Transferencia"

export interface OrderCustomer {
  nombre: string
  telefono: string
  direccion: string
  barrio: string
}

export interface Product {
  id: string
  name: string
  src: string
  price: number
  description: string
  available: boolean
}

export interface Modifier {
  id: string
  name: string
  price: number
  src: string
  available: boolean
}

/** Selection state of a modifier inside a cart item (catalog `cantidad` is selection state, not catalog data). */
export interface ModifierChoice {
  id: string
  name: string
  price: number
  cantidad: number
}

/** Snapshot by value: cart keeps this copy when products/modifiers change. */
export interface CartItem {
  id: string
  productId: string
  name: string
  src: string
  unitPrice: number
  cantidad: number
  modifiers: ModifierChoice[]
  observacion: string
  total: number
}

export type OrderStatus = "new" | "confirmed" | "delivered" | "cancelled"

export interface Order {
  id: number
  items: CartItem[]
  customer: OrderCustomer
  metodo: MetodoPago
  pagoCon?: string
  comentario?: string
  total: number
  status: OrderStatus
  createdAt: string
}

export interface RestaurantConfig {
  name: string
  whatsapp: string
  logo: string
  accent: string
  adminPassword: string
}