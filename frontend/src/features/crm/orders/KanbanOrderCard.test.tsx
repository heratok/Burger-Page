import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { KanbanOrderCard } from "./KanbanOrderCard"
import type { Order } from "@/types/restaurant"

const mockCan = vi.fn().mockImplementation((_p: string) => true)

vi.mock("@/context/slices/AuthContext", () => ({
  useAuth: () => ({
    can: mockCan,
  }),
}))

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

const tableOrder: Order = {
  ...mockOrder,
  customer: { ...mockOrder.customer, nombre: "Cliente Salón", direccion: "Salón", barrio: "Local" },
  tableId: "tbl_4",
  tableLabel: "Mesa 4",
}

const legacyTableOrder: Order = {
  ...mockOrder,
  customer: { ...mockOrder.customer, nombre: "Mesa 8", direccion: "Salón - Mesa 8", barrio: "Local" },
}

describe("KanbanOrderCard", () => {
  beforeEach(() => {
    mockCan.mockImplementation(() => true)
  })

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

  it("shows the salon table instead of barrio and address", () => {
    render(<KanbanOrderCard order={tableOrder} onViewDetails={vi.fn()} onUpdateStatus={vi.fn()} onWhatsApp={vi.fn()} />)

    expect(screen.getByText("Salón · Mesa 4")).toBeDefined()
    expect(screen.queryByText(/Local - Salón/)).toBeNull()
  })

  it("shows the table text of a legacy order registered before tables existed", () => {
    render(<KanbanOrderCard order={legacyTableOrder} onViewDetails={vi.fn()} onUpdateStatus={vi.fn()} onWhatsApp={vi.fn()} />)

    expect(screen.getByText("Salón · Mesa 8")).toBeDefined()
  })

  it("hides status action button and edit button when user lacks orders.manage permission", () => {
    mockCan.mockImplementation((p) => p !== "orders.manage")
    const onViewDetails = vi.fn()
    const onWhatsApp = vi.fn()
    const onEditOrder = vi.fn()

    const { rerender } = render(
      <KanbanOrderCard
        order={mockOrder}
        onViewDetails={onViewDetails}
        onUpdateStatus={vi.fn()}
        onWhatsApp={onWhatsApp}
        onEditOrder={onEditOrder}
      />
    )

    // Pending: A Cocina and edit should be hidden
    expect(screen.queryByRole("button", { name: /A Cocina/i })).toBeNull()
    expect(screen.queryByTitle("Editar venta")).toBeNull()

    // View details and WhatsApp remain accessible
    const viewBtn = screen.getByTitle("Ver detalles completos del pedido")
    fireEvent.click(viewBtn)
    expect(onViewDetails).toHaveBeenCalledWith(mockOrder)

    const whatsappBtn = screen.getByTitle("Chat WhatsApp con cliente")
    fireEvent.click(whatsappBtn)
    expect(onWhatsApp).toHaveBeenCalledWith(mockOrder)

    // Total remains visible
    expect(screen.getByText("$55.000")).toBeDefined()

    // Cooking: Despachar is hidden
    rerender(
      <KanbanOrderCard
        order={{ ...mockOrder, status: "cooking" }}
        onViewDetails={onViewDetails}
        onUpdateStatus={vi.fn()}
        onWhatsApp={onWhatsApp}
        onEditOrder={onEditOrder}
      />
    )
    expect(screen.queryByRole("button", { name: /Despachar/i })).toBeNull()

    // Delivering: Entregado is hidden
    rerender(
      <KanbanOrderCard
        order={{ ...mockOrder, status: "delivering" }}
        onViewDetails={onViewDetails}
        onUpdateStatus={vi.fn()}
        onWhatsApp={onWhatsApp}
        onEditOrder={onEditOrder}
      />
    )
    expect(screen.queryByRole("button", { name: /Entregado/i })).toBeNull()
  })

  it("renders quick printer button and calls onPrintOrder when clicked", () => {
    const onPrintOrder = vi.fn()
    render(
      <KanbanOrderCard
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
      <KanbanOrderCard
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

    expect(screen.queryByRole("button", { name: /A Cocina/i })).toBeNull()
    expect(screen.queryByTitle("Editar venta")).toBeNull()
  })

  it("hides ticket print button when user lacks orders.view and orders.manage", () => {
    mockCan.mockImplementation((p) => p === "finance.view")
    render(
      <KanbanOrderCard
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
