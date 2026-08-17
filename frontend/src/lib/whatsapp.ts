import type { CartItem, MetodoPago, OrderCustomer } from "./domain"

export interface OrderPayload {
  orderId: number
  customer: OrderCustomer
  items: CartItem[]
  metodo: MetodoPago
  pagoCon?: string
  comentario?: string
}

export const WHATSAPP_NUMBER = "573022575805"

/** Formato de moneda colombiano determinista ($27.000). */
export function formatCOP(value: number): string {
  return `$${value.toLocaleString("es-CO")}`
}

/**
 * Calcula el cambio en efectivo.
 * Devuelve null cuando no aplica: sin monto, monto inválido o insuficiente.
 */
export function calculateChange(total: number, pagoCon?: string): number | null {
  if (!pagoCon) return null
  const amount = Number(pagoCon.replace(/\D/g, ""))
  if (!Number.isFinite(amount) || amount <= 0) return null
  const change = amount - total
  return change > 0 ? change : null
}

function formatItem(item: CartItem, index: number): string {
  const lines = [
    `${index + 1}. ${item.cantidad}× ${item.name.toUpperCase().trim()} — ${formatCOP(item.total)}`,
  ]

  const additions = (item.modifiers ?? []).filter((m) => m.cantidad > 0)
  if (additions.length > 0) {
    lines.push(`   + ${additions.map((m) => `${m.cantidad}× ${m.name}`).join(", ")}`)
  }

  if (item.observacion?.trim()) {
    lines.push(`   Nota: ${item.observacion.trim()}`)
  }

  return lines.join("\n")
}

/**
 * Construye el mensaje de pedido para WhatsApp.
 * Renderiza correctamente cualquier combinación: pedidos sin adiciones,
 * sin notas, pago por transferencia, efectivo sin monto, sin comentario, etc.
 */
export function buildOrderMessage(payload: OrderPayload): string {
  const { orderId, customer, items, metodo, pagoCon, comentario } = payload
  const total = items.reduce((acc, item) => acc + item.total, 0)
  const sections: string[] = []

  sections.push("*NUEVO PEDIDO — BURGER PAGE*")
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
      const amountNumber = Number(amount.replace(/\D/g, ""))
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

  sections.push(`*TOTAL: ${formatCOP(total)}*`)

  if (comentario?.trim()) {
    sections.push("*COMENTARIO*")
    sections.push(comentario.trim())
  }

  sections.push("¡Gracias!")

  return sections.join("\n\n")
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}
