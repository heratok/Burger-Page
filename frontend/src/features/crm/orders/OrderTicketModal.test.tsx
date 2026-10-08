import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { OrderTicketModal } from "./OrderTicketModal"
import type { Order } from "@/types/restaurant"

const mockOrder: Order = {
  id: "ord-123",
  orderNumber: 204,
  customer: {
    nombre: "Juan Pérez",
    telefono: "3109876543",
    direccion: "Carrera 43A # 1-50",
    barrio: "El Poblado",
  },
  items: [
    {
      id: "item-1",
      name: "Hamburguesa Doble Carne",
      price: 28000,
      cantidad: 2,
      total: 56000,
      adiciones: [
        { name: "Tocineta Extra", price: 4000, cantidad: 1 },
        { name: "Queso Cheddar", price: 3000, cantidad: 2 },
      ],
      observacion: "Término medio, sin salsas",
    },
    {
      id: "item-2",
      name: "Papas Rústicas",
      price: 12000,
      cantidad: 1,
      total: 12000,
    },
  ],
  total: 68000,
  deliveryFee: 5000,
  finalTotal: 73000,
  metodo: "Efectivo",
  pagoCon: "100000",
  cambio: 27000,
  status: "pending",
  createdAt: "2026-10-06T15:30:00.000Z",
  updatedAt: "2026-10-06T15:30:00.000Z",
  comentario: "Por favor timbre fuerte",
}

const tableOrder: Order = {
  ...mockOrder,
  orderNumber: 205,
  customer: {
    nombre: "Cliente Salón",
    telefono: "",
    direccion: "Salón",
    barrio: "Restaurante",
  },
  tableId: "tbl-7",
  tableLabel: "Mesa 7",
  deliveryFee: 0,
  finalTotal: 68000,
}

describe("OrderTicketModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("does not render when isOpen is false or order is null", () => {
    const { container: c1 } = render(
      <OrderTicketModal
        isOpen={false}
        order={mockOrder}
        onClose={vi.fn()}
      />
    )
    expect(c1.firstChild).toBeNull()

    const { container: c2 } = render(
      <OrderTicketModal
        isOpen={true}
        order={null}
        onClose={vi.fn()}
      />
    )
    expect(c2.firstChild).toBeNull()
  })

  it("renders full ticket / despacho by default with customer info, address, delivery fee, additions, items, payment and totals", () => {
    render(
      <OrderTicketModal
        isOpen={true}
        order={mockOrder}
        onClose={vi.fn()}
        storeName="BURGER TEST"
      />
    )

    // Store header & order number
    expect(screen.getByText("BURGER TEST")).toBeDefined()
    expect(screen.getAllByText(/ORDEN #204/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/TICKET DE VENTA \/ DESPACHO/i)).toBeDefined()

    // Customer details
    expect(screen.getByText(/^CLIENTE:/i)).toBeDefined()
    expect(screen.getByText(/Juan Pérez/i)).toBeDefined()
    expect(screen.getByText(/Carrera 43A # 1-50/i)).toBeDefined()
    expect(screen.getByText(/El Poblado/i)).toBeDefined()
    expect(screen.getByText(/Por favor timbre fuerte/i)).toBeDefined()

    // Items and additions
    expect(screen.getByText(/Hamburguesa Doble Carne/i)).toBeDefined()
    expect(screen.getByText(/\+ 1x Tocineta Extra/i)).toBeDefined()
    expect(screen.getByText(/\+ 2x Queso Cheddar/i)).toBeDefined()
    expect(screen.getByText(/\* Obs: Término medio, sin salsas/i)).toBeDefined()
    expect(screen.getByText(/Papas Rústicas/i)).toBeDefined()

    // Totals and payment
    expect(screen.getByText(/TOTAL A PAGAR:/i)).toBeDefined()
    expect(screen.getAllByText(/\$73\.000/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Costo de envío:/i)).toBeDefined()
    expect(screen.getByText(/\$5\.000/i)).toBeDefined()
    expect(screen.getByText(/MÉTODO DE PAGO:/i)).toBeDefined()
    expect(screen.getByText(/Efectivo/i)).toBeDefined()
    expect(screen.getByText(/PAGA CON:/i)).toBeDefined()
    expect(screen.getByText(/\$100\.000/i)).toBeDefined()
    expect(screen.getByText(/CAMBIO: \$27\.000/i)).toBeDefined()
  })

  it("switches between Full Ticket and Kitchen Ticket (KOT) modes", () => {
    render(
      <OrderTicketModal
        isOpen={true}
        order={mockOrder}
        onClose={vi.fn()}
      />
    )

    const fullTab = screen.getByRole("tab", { name: /Ticket Completo/i })
    const kitchenTab = screen.getByRole("tab", { name: /Comanda Cocina/i })

    expect(fullTab.getAttribute("aria-selected")).toBe("true")
    expect(kitchenTab.getAttribute("aria-selected")).toBe("false")
    expect(screen.getByText(/TICKET DE VENTA \/ DESPACHO/i)).toBeDefined()

    // Click kitchen tab
    fireEvent.click(kitchenTab)

    expect(kitchenTab.getAttribute("aria-selected")).toBe("true")
    expect(fullTab.getAttribute("aria-selected")).toBe("false")
    expect(screen.getByText(/\*\*\* COMANDA COCINA \(KOT\) \*\*\*/i)).toBeDefined()

    // Switch back to full tab
    fireEvent.click(fullTab)
    expect(fullTab.getAttribute("aria-selected")).toBe("true")
    expect(screen.getByText(/TICKET DE VENTA \/ DESPACHO/i)).toBeDefined()
  })

  it("renders kitchen comanda mode focusing on order number, items, bold additions, and observations, omitting payment info", () => {
    render(
      <OrderTicketModal
        isOpen={true}
        order={mockOrder}
        initialMode="kitchen"
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText(/\*\*\* COMANDA COCINA \(KOT\) \*\*\*/i)).toBeDefined()
    expect(screen.getAllByText(/ORDEN #204/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/2X/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/HAMBURGUESA DOBLE CARNE/i)).toBeDefined()
    expect(screen.getByText(/>> \+ 1X TOCINETA EXTRA/i)).toBeDefined()
    expect(screen.getByText(/>> \+ 2X QUESO CHEDDAR/i)).toBeDefined()
    expect(screen.getByText(/\*\* OBS: Término medio, sin salsas \*\*/i)).toBeDefined()
    expect(screen.getByText(/TOTAL ÍTEMS A PREPARAR:/i)).toBeDefined()
    expect(screen.getByText("3")).toBeDefined() // 2 + 1
    expect(screen.getByText(/--- ENVIADO A COCINA ---/i)).toBeDefined()

    // Kitchen comanda should NOT show payment/cash change or delivery fee calculations
    expect(screen.queryByText(/TOTAL A PAGAR:/i)).toBeNull()
    expect(screen.queryByText(/PAGA CON:/i)).toBeNull()
    expect(screen.queryByText(/Costo de envío:/i)).toBeNull()
  })

  it("renders salon table label when order has tableLabel or tableId", () => {
    render(
      <OrderTicketModal
        isOpen={true}
        order={tableOrder}
        initialMode="kitchen"
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText(/SALÓN · MESA 7/i)).toBeDefined()
  })

  it("calls window.print when clicking Imprimir button", () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {})

    render(
      <OrderTicketModal
        isOpen={true}
        order={mockOrder}
        onClose={vi.fn()}
      />
    )

    const printBtn = screen.getByRole("button", { name: /Imprimir Ticket/i })
    fireEvent.click(printBtn)

    expect(printSpy).toHaveBeenCalledTimes(1)
    printSpy.mockRestore()
  })

  it("calls onClose when clicking close button or pressing Escape key", () => {
    const onClose = vi.fn()

    render(
      <OrderTicketModal
        isOpen={true}
        order={mockOrder}
        onClose={onClose}
      />
    )

    const closeBtn = screen.getByRole("button", { name: /Cerrar vista previa/i })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)

    // Press Escape
    fireEvent.keyDown(window, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
