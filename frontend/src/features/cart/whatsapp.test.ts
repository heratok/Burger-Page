import { describe, it, expect, vi, afterEach } from "vitest"
import {
  buildOrderMessage,
  calculateChange,
  formatCOP,
  generateOrderId,
  buildWhatsAppUrl,
  isMobileDevice,
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

describe("isMobileDevice", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const stubNavigator = (nav: Partial<Navigator>) => vi.stubGlobal("navigator", nav)

  it.each([
    ["Android", "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36"],
    ["iPhone", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"],
    ["iPad", "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15"],
    ["iPod", "Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X)"],
    ["generic Mobile", "Mozilla/5.0 (Mobile; rv:109.0) Gecko/109.0 Firefox/115.0"],
  ])("detects %s user agents", (_name, userAgent) => {
    stubNavigator({ userAgent, platform: "Linux armv8l", maxTouchPoints: 5 })
    expect(isMobileDevice()).toBe(true)
  })

  it("detects iPadOS that reports a desktop Mac user agent", () => {
    stubNavigator({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
      platform: "MacIntel",
      maxTouchPoints: 5,
    })
    expect(isMobileDevice()).toBe(true)
  })

  it("treats a real desktop Mac and Windows as desktop", () => {
    stubNavigator({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
      platform: "MacIntel",
      maxTouchPoints: 0,
    })
    expect(isMobileDevice()).toBe(false)
    stubNavigator({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
      platform: "Win32",
      maxTouchPoints: 0,
    })
    expect(isMobileDevice()).toBe(false)
  })

  it("returns false when navigator is unavailable", () => {
    vi.stubGlobal("navigator", undefined)
    expect(isMobileDevice()).toBe(false)
  })
})
