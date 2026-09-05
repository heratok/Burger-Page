import { formatCurrency, cleanPhoneNumber, formatWhatsAppPhone } from "@/lib/utils"
import type { CartItem } from "./cartEngine"

export type MetodoPago = "Efectivo" | "Transferencia"

export interface OrderCustomer {
  nombre: string
  telefono: string
  direccion: string
  barrio: string
}

export interface OrderPayload {
  orderId: number
  customer: OrderCustomer
  items: CartItem[]
  metodo: MetodoPago
  pagoCon?: string
  comentario?: string
  restaurantName?: string
  deliveryFee?: number
}

/** Genera un número de orden de 6 dígitos (100000–999999). */
export function generateOrderId(): number {
  return Math.floor(100000 + Math.random() * 900000)
}

/** Formato de moneda colombiano determinista ($27.000). */
export function formatCOP(value: number): string {
  return formatCurrency(value, "$")
}

/**
 * Calcula el cambio en efectivo.
 * Devuelve null cuando no aplica: sin monto, monto inválido o insuficiente.
 */
export function calculateChange(total: number, pagoCon?: string): number | null {
  if (!pagoCon) return null
  const amount = Number(cleanPhoneNumber(pagoCon))
  if (!Number.isFinite(amount) || amount <= 0) return null
  const change = amount - total
  return change > 0 ? change : null
}

function formatItem(item: CartItem, index: number): string {
  const lines = [
    `${index + 1}. ${item.cantidad}× ${item.name.toUpperCase().trim()} — ${formatCOP(item.total)}`,
  ]

  const additions = (item.adiciones ?? []).filter((a) => a.cantidad > 0)
  if (additions.length > 0) {
    lines.push(`   + ${additions.map((a) => `${a.cantidad}× ${a.name}`).join(", ")}`)
  }

  if (item.observacion?.trim()) {
    lines.push(`   Nota: ${item.observacion.trim()}`)
  }

  return lines.join("\n")
}

/**
 * Construye el mensaje de pedido para WhatsApp.
 */
export function buildOrderMessage(payload: OrderPayload): string {
  const {
    orderId,
    customer,
    items,
    metodo,
    pagoCon,
    comentario,
    restaurantName = "BURGER PAGE",
    deliveryFee = 0,
  } = payload

  const subtotal = items.reduce((acc, item) => acc + item.total, 0)
  const total = subtotal + (items.length > 0 ? deliveryFee : 0)
  const sections: string[] = []

  sections.push(`*NUEVO PEDIDO — ${restaurantName.toUpperCase()}*`)
  sections.push(`Orden: #${orderId}`)

  sections.push("*CLIENTE*")
  sections.push(`Nombre: ${customer.nombre.trim()}`)
  sections.push(`Celular: ${customer.telefono.trim()}`)

  sections.push("*ENTREGA*")
  sections.push(`Dirección: ${customer.direccion.trim()}`)
  sections.push(`Barrio: ${customer.barrio.trim()}`)

  if (items.length > 0) {
    sections.push("*PEDIDO*")
    sections.push(items.map(formatItem).join("\n"))
  }

  const pagoLines = [`Método: ${metodo}`]
  if (metodo === "Efectivo") {
    const amount = pagoCon?.trim()
    if (amount) {
      const amountNumber = Number(cleanPhoneNumber(amount))
      if (Number.isFinite(amountNumber) && amountNumber > 0) {
        pagoLines.push(`Paga con: ${formatCOP(amountNumber)}`)
        const change = calculateChange(total, amount)
        if (change !== null) {
          pagoLines.push(`Cambio: ${formatCOP(change)}`)
        }
      }
    }
  }
  sections.push("*PAGO*")
  sections.push(pagoLines.join("\n"))

  if (deliveryFee > 0) {
    sections.push(
      `Subtotal: ${formatCOP(subtotal)}\nDomicilio: ${formatCOP(deliveryFee)}\n*TOTAL: ${formatCOP(total)}*`
    )
  } else {
    sections.push(`*TOTAL: ${formatCOP(total)}*`)
  }

  if (comentario?.trim()) {
    sections.push("*COMENTARIO*")
    sections.push(comentario.trim())
  }

  sections.push("¡Gracias!")

  return sections.join("\n\n")
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const cleanPhone = formatWhatsAppPhone(phone)
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
}
