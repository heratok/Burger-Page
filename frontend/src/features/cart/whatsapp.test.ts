import { describe, it, expect } from "vitest"
import {
  buildOrderMessage,
  calculateChange,
  formatCOP,
  generateOrderId,
  buildWhatsAppUrl,
} from "./whatsapp"
import type { CartItem } from "./cartEngine"

describe("WhatsApp module in features/cart", () => {
  it("formats COP currency", () => {
    expect(formatCOP(25000)).toMatch(/\$25[.,]000/)
  })

  it("calculates cash change accurately", () => {
    expect(calculateChange(45000, "50000")).toBe(5000)
    expect(calculateChange(45000, "40000")).toBeNull()
    expect(calculateChange(45000, undefined)).toBeNull()
    expect(calculateChange(45000, "invalid")).toBeNull()
  })

  it("generates a 6-digit order ID", () => {
    const id = generateOrderId()
    expect(id).toBeGreaterThanOrEqual(100000)
    expect(id).toBeLessThanOrEqual(999999)
  })

  it("builds a complete WhatsApp message", () => {
    const mockItems: CartItem[] = [
      {
        id: "item-1",
        name: "Mega Burger",
        price: 28000,
        cantidad: 2,
        total: 62000,
        src: "",
        observacion: "Sin cebolla",
        adiciones: [{ name: "Extra Bacon", price: 3000, cantidad: 2 }],
      },
    ]

    const message = buildOrderMessage({
      orderId: 123456,
      customer: {
        nombre: "John Doe",
        telefono: "3001234567",
        direccion: "Calle 10 # 20-30",
        barrio: "Centro",
      },
      items: mockItems,
      metodo: "Efectivo",
      pagoCon: "70000",
      comentario: "Tocar timbre 201",
      restaurantName: "Burger Craft",
      deliveryFee: 4000,
    })

    expect(message).toContain("*NUEVO PEDIDO — BURGER CRAFT*")
    expect(message).toContain("Orden: #123456")
    expect(message).toContain("Nombre: John Doe")
    expect(message).toContain("2× MEGA BURGER")
    expect(message).toContain("+ 2× Extra Bacon")
  })

  it("creates a valid WhatsApp wa.me url", () => {
    const url = buildWhatsAppUrl("573001234567", "Hola test")
    expect(url).toBe("https://wa.me/573001234567?text=Hola%20test")
  })
})
