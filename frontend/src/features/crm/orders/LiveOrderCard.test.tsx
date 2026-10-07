import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { LiveOrderCard } from "./LiveOrderCard"
import type { Order } from "@/types/restaurant"

const mockCan = vi.fn().mockImplementation((_p: string) => true)

vi.mock("@/context/slices/AuthContext", () => ({
  useAuth: () => ({
    can: mockCan,
  }),
}))

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

const tableOrder: Order = {
  ...mockOrder,
  customer: { ...mockOrder.customer, nombre: "Cliente Salón", direccion: "Salón", barrio: "Local" },
  tableId: "tbl_4",
  tableLabel: "Mesa 4",
}

describe("LiveOrderCard", () => {
  beforeEach(() => {
    mockCan.mockImplementation(() => true)
  })

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

  it("shows edit button only for active orders and hides it for delivered/cancelled", () => {
    const onEditOrder = vi.fn()

    const { rerender } = render(
      <LiveOrderCard
        order={mockOrder}
        onViewDetails={vi.fn()}
        onUpdateStatus={vi.fn()}
        onWhatsApp={vi.fn()}
        onEditOrder={onEditOrder}
      />
    )

    const editBtn = screen.getByTitle("Editar venta")
    expect(editBtn).toBeDefined()
    fireEvent.click(editBtn)
    expect(onEditOrder).toHaveBeenCalledWith(mockOrder)

    // Delivered order hides edit button
    rerender(
      <LiveOrderCard
        order={{ ...mockOrder, status: "delivered" }}
        onViewDetails={vi.fn()}
        onUpdateStatus={vi.fn()}
        onWhatsApp={vi.fn()}
        onEditOrder={onEditOrder}
      />
    )
    expect(screen.queryByTitle("Editar venta")).toBeNull()

    // Cancelled order hides edit button
    rerender(
      <LiveOrderCard
        order={{ ...mockOrder, status: "cancelled" }}
        onViewDetails={vi.fn()}
        onUpdateStatus={vi.fn()}
        onWhatsApp={vi.fn()}
        onEditOrder={onEditOrder}
      />
    )
    expect(screen.queryByTitle("Editar venta")).toBeNull()
  })

  it("shows the salon table instead of barrio and address", () => {
    render(<LiveOrderCard order={tableOrder} onViewDetails={vi.fn()} onUpdateStatus={vi.fn()} onWhatsApp={vi.fn()} />)

    expect(screen.getByText("Salón · Mesa 4")).toBeDefined()
  })

  it("hides status action buttons and edit button when user lacks orders.manage permission", () => {
    mockCan.mockImplementation((p) => p !== "orders.manage")
    const onViewDetails = vi.fn()
    const onWhatsApp = vi.fn()
    const onEditOrder = vi.fn()

    const { rerender } = render(
      <LiveOrderCard
        order={mockOrder}
        onViewDetails={onViewDetails}
        onUpdateStatus={vi.fn()}
        onWhatsApp={onWhatsApp}
        onEditOrder={onEditOrder}
      />
    )

    // Pending: 1-click completion, A Cocina, and edit should all be hidden
    expect(screen.queryByRole("button", { name: /Completar \(1 Clic\)/i })).toBeNull()
    expect(screen.queryByTitle("Mover a cocina")).toBeNull()
    expect(screen.queryByTitle("Editar venta")).toBeNull()

    // View details and WhatsApp remain accessible
    const viewBtn = screen.getByTitle("Ver detalles completos de la orden")
    fireEvent.click(viewBtn)
    expect(onViewDetails).toHaveBeenCalledWith(mockOrder)

    const whatsappBtn = screen.getByTitle("Chat WhatsApp con cliente")
    fireEvent.click(whatsappBtn)
    expect(onWhatsApp).toHaveBeenCalledWith(mockOrder)

    // Order totals remain visible
    expect(screen.getByText("$32.000")).toBeDefined()

    // Cooking: Despachar is hidden
    rerender(
      <LiveOrderCard
        order={{ ...mockOrder, status: "cooking" }}
        onViewDetails={onViewDetails}
        onUpdateStatus={vi.fn()}
        onWhatsApp={onWhatsApp}
        onEditOrder={onEditOrder}
      />
    )
    expect(screen.queryByRole("button", { name: /Completar \(1 Clic\)/i })).toBeNull()
    expect(screen.queryByTitle("Despachar con repartidor")).toBeNull()

    // Delivered: Reabrir Orden is hidden
    rerender(
      <LiveOrderCard
        order={{ ...mockOrder, status: "delivered" }}
        onViewDetails={onViewDetails}
        onUpdateStatus={vi.fn()}
        onWhatsApp={onWhatsApp}
        onEditOrder={onEditOrder}
      />
    )
    expect(screen.queryByRole("button", { name: /Reabrir Orden/i })).toBeNull()
  })

  it("renders quick printer button and calls onPrintOrder when clicked", () => {
    const onPrintOrder = vi.fn()
    render(
      <LiveOrderCard
        order={mockOrder}
        onViewDetails={vi.fn()}
        onUpdateStatus={vi.fn()}
        onWhatsApp={vi.fn()}
        onPrintOrder={onPrintOrder}
      />
    )

    const printBtn = screen.getByRole("button", { name: /Imprimir ticket \/ comanda/i })
    expect(printBtn).toBeDefined()
    fireEvent.click(printBtn)
    expect(onPrintOrder).toHaveBeenCalledWith(mockOrder)
  })

  it("allows read-only user with orders.view to see and click print button while hiding mutation buttons", () => {
    mockCan.mockImplementation((p) => p === "orders.view")
    const onPrintOrder = vi.fn()
    const onEditOrder = vi.fn()
    const onUpdateStatus = vi.fn()

    render(
      <LiveOrderCard
        order={mockOrder}
        onViewDetails={vi.fn()}
        onUpdateStatus={onUpdateStatus}
        onWhatsApp={vi.fn()}
        onEditOrder={onEditOrder}
        onPrintOrder={onPrintOrder}
      />
    )

    const printBtn = screen.getByRole("button", { name: /Imprimir ticket \/ comanda/i })
    expect(printBtn).toBeDefined()
    fireEvent.click(printBtn)
    expect(onPrintOrder).toHaveBeenCalledWith(mockOrder)

    expect(screen.queryByRole("button", { name: /Completar \(1 Clic\)/i })).toBeNull()
    expect(screen.queryByTitle("Mover a cocina")).toBeNull()
    expect(screen.queryByTitle("Editar venta")).toBeNull()
  })

  it("hides ticket print button when user lacks orders.view and orders.manage", () => {
    mockCan.mockImplementation((p) => p === "finance.view")
    render(
      <LiveOrderCard
        order={mockOrder}
        onViewDetails={vi.fn()}
        onUpdateStatus={vi.fn()}
        onWhatsApp={vi.fn()}
        onPrintOrder={vi.fn()}
      />
    )
    expect(screen.queryByRole("button", { name: /Imprimir ticket \/ comanda/i })).toBeNull()
  })
})
