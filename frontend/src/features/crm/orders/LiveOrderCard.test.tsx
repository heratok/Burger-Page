import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { LiveOrderCard } from "./LiveOrderCard"
import type { Order } from "@/types/restaurant"

const mockOrder: Order = {
  id: "ord-202",
  orderNumber: 202,
  customer: {
    nombre: "Mariana Restrepo",
    telefono: "3109876543",
    direccion: "Carrera 43A # 1-50",
    barrio: "Laureles",
  },
  items: [
    {
      id: "item-1",
      name: "Burger Artesanal",
      price: 28000,
      cantidad: 1,
      total: 28000,
      adiciones: [{ name: "Tocineta", price: 4000, cantidad: 1 }],
      observacion: "Término medio",
    },
  ],
  comentario: "Por favor enviar servilletas extra",
  total: 28000,
  deliveryFee: 4000,
  finalTotal: 32000,
  metodo: "Efectivo",
  pagoCon: "50000",
  cambio: 18000,
  status: "pending",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe("LiveOrderCard", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders ticket order information with 1-click completion button", () => {
    const onViewDetails = vi.fn()
    const onUpdateStatus = vi.fn()
    const onWhatsApp = vi.fn()

    render(
      <LiveOrderCard
        order={mockOrder}
        onViewDetails={onViewDetails}
        onUpdateStatus={onUpdateStatus}
        onWhatsApp={onWhatsApp}
      />
    )

    expect(screen.getByText("#202")).toBeDefined()
    expect(screen.getByText("Mariana Restrepo")).toBeDefined()
    expect(screen.getByText(/Laureles — Carrera 43A # 1-50/i)).toBeDefined()
    expect(screen.getByText(/1× Burger Artesanal/i)).toBeDefined()
    expect(screen.getByText(/Por favor enviar servilletas extra/i)).toBeDefined()
    expect(screen.getByText("Efectivo")).toBeDefined()
    expect(screen.getByText(/Cambio:/i)).toBeDefined()

    // 1-Click completion
    const completeBtn = screen.getByRole("button", { name: /Completar \(1 Clic\)/i })
    fireEvent.click(completeBtn)
    expect(onUpdateStatus).toHaveBeenCalledWith("ord-202", "delivered")
  })

  it("allows moving order to cooking or delivering step-by-step", () => {
    const onUpdateStatus = vi.fn()

    const { rerender } = render(
      <LiveOrderCard
        order={mockOrder}
        onViewDetails={vi.fn()}
        onUpdateStatus={onUpdateStatus}
        onWhatsApp={vi.fn()}
      />
    )

    const kitchenBtn = screen.getByTitle("Mover a cocina")
    fireEvent.click(kitchenBtn)
    expect(onUpdateStatus).toHaveBeenCalledWith("ord-202", "cooking")

    // Rerender as cooking
    rerender(
      <LiveOrderCard
        order={{ ...mockOrder, status: "cooking" }}
        onViewDetails={vi.fn()}
        onUpdateStatus={onUpdateStatus}
        onWhatsApp={vi.fn()}
      />
    )

    const dispatchBtn = screen.getByTitle("Despachar con repartidor")
    fireEvent.click(dispatchBtn)
    expect(onUpdateStatus).toHaveBeenCalledWith("ord-202", "delivering")
  })

  it("handles reopen order when status is delivered", () => {
    const onUpdateStatus = vi.fn()

    render(
      <LiveOrderCard
        order={{ ...mockOrder, status: "delivered" }}
        onViewDetails={vi.fn()}
        onUpdateStatus={onUpdateStatus}
        onWhatsApp={vi.fn()}
      />
    )

    const reopenBtn = screen.getByRole("button", { name: /Reabrir Orden/i })
    fireEvent.click(reopenBtn)
    expect(onUpdateStatus).toHaveBeenCalledWith("ord-202", "pending")
  })

  it("triggers view details and WhatsApp callbacks", () => {
    const onViewDetails = vi.fn()
    const onWhatsApp = vi.fn()

    render(
      <LiveOrderCard
        order={mockOrder}
        onViewDetails={onViewDetails}
        onUpdateStatus={vi.fn()}
        onWhatsApp={onWhatsApp}
      />
    )

    const viewBtn = screen.getByTitle("Ver detalles completos de la orden")
    fireEvent.click(viewBtn)
    expect(onViewDetails).toHaveBeenCalledWith(mockOrder)

    const whatsappBtn = screen.getByTitle("Chat WhatsApp con cliente")
    fireEvent.click(whatsappBtn)
    expect(onWhatsApp).toHaveBeenCalledWith(mockOrder)
  })
})
