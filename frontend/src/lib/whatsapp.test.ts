import { describe, expect, it } from "vitest"
import { buildOrderMessage } from "./whatsapp"
import type { CartItem, MetodoPago, OrderCustomer } from "./domain"

const customer: OrderCustomer = {
  nombre: "Juan Pérez",
  telefono: "3001234567",
  direccion: "Calle 1 #2-3",
  barrio: "Centro",
}

const items: CartItem[] = [
  {
    id: "c1",
    productId: "p1",
    name: "Pizza Margherita",
    src: "",
    unitPrice: 32000,
    cantidad: 1,
    modifiers: [],
    observacion: "",
    total: 32000,
  },
]

function payload() {
  return {
    orderId: 42,
    customer,
    items,
    metodo: "Efectivo" as MetodoPago,
    pagoCon: "50000",
  }
}

describe("buildOrderMessage header (ST-1)", () => {
  it("uses the active restaurant name in the order header", () => {
    const message = buildOrderMessage(payload(), "PIZZA ROMA")

    expect(message).toContain("*NUEVO PEDIDO — PIZZA ROMA*")
  })

  it("reflects a different restaurant without leaking the previous one", () => {
    const message = buildOrderMessage(payload(), "SUSHI TOKIO")

    expect(message).toContain("*NUEVO PEDIDO — SUSHI TOKIO*")
    expect(message).not.toContain("PIZZA ROMA")
  })
})