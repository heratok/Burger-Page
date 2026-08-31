import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { KanbanOrderCard } from "./KanbanOrderCard"
import type { Order } from "@/types/restaurant"

const mockOrder: Order = {
  id: "ord-1",
  orderNumber: 101,
  customer: {
    nombre: "Carlos Gómez",
    telefono: "3001234567",
    direccion: "Calle 10 # 4-20",
    barrio: "El Poblado",
  },
  items: [
    {
      id: "i-1",
      name: "Hamburguesa Doble",
      price: 25000,
      cantidad: 2,
      total: 50000,
      adiciones: [{ name: "Queso", price: 3000, cantidad: 1 }],
      observacion: "Bien cocida",
    },
  ],
  comentario: "Sin cebolla",
  total: 50000,
  deliveryFee: 5000,
  finalTotal: 55000,
  metodo: "Efectivo",
  pagoCon: "60000",
  cambio: 5000,
  status: "pending",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe("KanbanOrderCard", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders order details, items summary and status action button for pending order", () => {
    const onViewDetails = vi.fn()
    const onUpdateStatus = vi.fn()
    const onWhatsApp = vi.fn()

    render(
      <KanbanOrderCard
        order={mockOrder}
        onViewDetails={onViewDetails}
        onUpdateStatus={onUpdateStatus}
        onWhatsApp={onWhatsApp}
      />
    )

    expect(screen.getByText("#101")).toBeDefined()
    expect(screen.getByText("Carlos Gómez")).toBeDefined()
    expect(screen.getByText(/El Poblado - Calle 10 # 4-20/i)).toBeDefined()
    expect(screen.getByText(/2× Hamburguesa Doble/i)).toBeDefined()
    expect(screen.getByText('"Sin cebolla"')).toBeDefined()
    expect(screen.getByText("Efectivo")).toBeDefined()

    const kitchenBtn = screen.getByRole("button", { name: /A Cocina/i })
    fireEvent.click(kitchenBtn)
    expect(onUpdateStatus).toHaveBeenCalledWith("ord-1", "cooking")
  })

  it("handles WhatsApp click and view details click", () => {
    const onViewDetails = vi.fn()
    const onUpdateStatus = vi.fn()
    const onWhatsApp = vi.fn()

    render(
      <KanbanOrderCard
        order={mockOrder}
        onViewDetails={onViewDetails}
        onUpdateStatus={onUpdateStatus}
        onWhatsApp={onWhatsApp}
      />
    )

    const viewBtn = screen.getByTitle("Ver detalles completos del pedido")
    fireEvent.click(viewBtn)
    expect(onViewDetails).toHaveBeenCalledWith(mockOrder)

    const whatsappBtn = screen.getByTitle("Chat WhatsApp con cliente")
    fireEvent.click(whatsappBtn)
    expect(onWhatsApp).toHaveBeenCalledWith(mockOrder)
  })

  it("renders status transition for cooking and delivering orders", () => {
    const onUpdateStatus = vi.fn()

    const { rerender } = render(
      <KanbanOrderCard
        order={{ ...mockOrder, status: "cooking" }}
        onViewDetails={vi.fn()}
        onUpdateStatus={onUpdateStatus}
        onWhatsApp={vi.fn()}
      />
    )
    const dispatchBtn = screen.getByRole("button", { name: /Despachar/i })
    fireEvent.click(dispatchBtn)
    expect(onUpdateStatus).toHaveBeenCalledWith("ord-1", "delivering")

    rerender(
      <KanbanOrderCard
        order={{ ...mockOrder, status: "delivering" }}
        onViewDetails={vi.fn()}
        onUpdateStatus={onUpdateStatus}
        onWhatsApp={vi.fn()}
      />
    )
    const deliveredBtn = screen.getByRole("button", { name: /Entregado/i })
    fireEvent.click(deliveredBtn)
    expect(onUpdateStatus).toHaveBeenCalledWith("ord-1", "delivered")
  })
})
