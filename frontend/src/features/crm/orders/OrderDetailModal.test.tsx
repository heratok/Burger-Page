import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { OrderDetailModal } from "./OrderDetailModal"
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
      adiciones: [{ name: "Queso Cheddar", price: 3000, cantidad: 1 }],
      observacion: "Bien cocida",
    },
  ],
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

describe("OrderDetailModal", () => {
  beforeEach(() => {
    mockCan.mockImplementation(() => true)
  })

  afterEach(() => {
    cleanup()
  })

  it("does not render when isOpen is false or order is null", () => {
    const { container } = render(
      <OrderDetailModal
        order={null}
        isOpen={false}
        onClose={vi.fn()}
        onUpdateStatus={vi.fn()}
        onDeleteOrder={vi.fn()}
        onWhatsApp={vi.fn()}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders order detail modal with customer, item breakdowns, totals and status advancers", () => {
    const onClose = vi.fn()
    const onUpdateStatus = vi.fn()
    const onDeleteOrder = vi.fn()
    const onWhatsApp = vi.fn()

    render(
      <OrderDetailModal
        order={mockOrder}
        isOpen={true}
        onClose={onClose}
        onUpdateStatus={onUpdateStatus}
        onDeleteOrder={onDeleteOrder}
        onWhatsApp={onWhatsApp}
      />
    )

    expect(screen.getByText("Orden #101")).toBeDefined()
    expect(screen.getByText("Carlos Gómez")).toBeDefined()
    expect(screen.getByText("WhatsApp: 3001234567")).toBeDefined()
    expect(screen.getByText(/Calle 10 # 4-20, Barrio El Poblado/i)).toBeDefined()
    expect(screen.getByText(/2× Hamburguesa Doble/i)).toBeDefined()
    expect(screen.getByText(/\+ 1× Queso Cheddar/i)).toBeDefined()
    expect(screen.getByText(/Nota: Bien cocida/i)).toBeDefined()

    // Test WhatsApp button
    const whatsappBtn = screen.getByText("WhatsApp: 3001234567")
    fireEvent.click(whatsappBtn)
    expect(onWhatsApp).toHaveBeenCalledWith(mockOrder)

    // Test advancing status to cooking
    const cookingBtn = screen.getByRole("button", { name: /🟠 En Cocina/i })
    fireEvent.click(cookingBtn)
    expect(onUpdateStatus).toHaveBeenCalledWith("ord-1", "cooking")
    expect(onClose).toHaveBeenCalled()

    // Test delete order
    const deleteBtn = screen.getByRole("button", { name: /Eliminar Orden/i })
    fireEvent.click(deleteBtn)
    expect(onDeleteOrder).toHaveBeenCalledWith(mockOrder)
  })

  it("renders transfer receipt and opens lightbox when receiptUrl is present", () => {
    const transferOrderWithReceipt: Order = {
      ...mockOrder,
      id: "ord-transfer-1",
      metodo: "Transferencia",
      receiptUrl: "https://example.com/receipt-img.webp",
    }

    render(
      <OrderDetailModal
        order={transferOrderWithReceipt}
        isOpen={true}
        onClose={vi.fn()}
        onUpdateStatus={vi.fn()}
        onDeleteOrder={vi.fn()}
        onWhatsApp={vi.fn()}
      />
    )

    expect(screen.getByText("Soporte de Transferencia")).toBeDefined()
    expect(screen.getByText("✓ Comprobante cargado")).toBeDefined()
    expect(screen.getByText("Ver soporte")).toBeDefined()

    // Click to open lightbox
    const viewSupportBtn = screen.getByText("Ver soporte")
    fireEvent.click(viewSupportBtn)
    expect(screen.getByAltText("Comprobante Orden #101")).toBeDefined()
  })

  it("renders attach transfer receipt button when order is Transferencia and receipt is missing", () => {
    const transferOrderWithoutReceipt: Order = {
      ...mockOrder,
      id: "ord-transfer-2",
      metodo: "Transferencia",
      receiptUrl: undefined,
    }

    render(
      <OrderDetailModal
        order={transferOrderWithoutReceipt}
        isOpen={true}
        onClose={vi.fn()}
        onUpdateStatus={vi.fn()}
        onDeleteOrder={vi.fn()}
        onWhatsApp={vi.fn()}
      />
    )

    expect(screen.getByText("Soporte de Transferencia")).toBeDefined()
    expect(screen.getByText("! Sin soporte adjunto")).toBeDefined()
    expect(screen.getByText("+ Adjuntar Soporte de Transferencia")).toBeDefined()
  })

  it("calls onEditOrder and closes modal when clicking Editar venta", () => {
    const onEditOrder = vi.fn()
    const onClose = vi.fn()

    render(
      <OrderDetailModal
        order={mockOrder}
        isOpen={true}
        onClose={onClose}
        onUpdateStatus={vi.fn()}
        onDeleteOrder={vi.fn()}
        onWhatsApp={vi.fn()}
        onEditOrder={onEditOrder}
      />
    )

    const editBtn = screen.getByRole("button", { name: /Editar venta/i })
    expect(editBtn).toBeDefined()
    fireEvent.click(editBtn)

    expect(onEditOrder).toHaveBeenCalledWith(mockOrder)
    expect(onClose).toHaveBeenCalled()
  })

  it("hides Editar venta button when order is delivered or cancelled", () => {
    const onEditOrder = vi.fn()

    const { rerender } = render(
      <OrderDetailModal
        order={{ ...mockOrder, status: "delivered" }}
        isOpen={true}
        onClose={vi.fn()}
        onUpdateStatus={vi.fn()}
        onDeleteOrder={vi.fn()}
        onWhatsApp={vi.fn()}
        onEditOrder={onEditOrder}
      />
    )

    expect(screen.queryByRole("button", { name: /Editar venta/i })).toBeNull()

    rerender(
      <OrderDetailModal
        order={{ ...mockOrder, status: "cancelled" }}
        isOpen={true}
        onClose={vi.fn()}
        onUpdateStatus={vi.fn()}
        onDeleteOrder={vi.fn()}
        onWhatsApp={vi.fn()}
        onEditOrder={onEditOrder}
      />
    )

    expect(screen.queryByRole("button", { name: /Editar venta/i })).toBeNull()
  })

  it("shows the salon table in the detail", () => {
    render(
      <OrderDetailModal
        order={tableOrder}
        isOpen={true}
        onClose={vi.fn()}
        onUpdateStatus={vi.fn()}
        onDeleteOrder={vi.fn()}
        onWhatsApp={vi.fn()}
      />
    )

    expect(screen.getByText("Salón · Mesa 4")).toBeDefined()
    expect(screen.queryByText(/Barrio Local/)).toBeNull()
  })

  it("shows the table text of a legacy order", () => {
    render(
      <OrderDetailModal
        order={legacyTableOrder}
        isOpen={true}
        onClose={vi.fn()}
        onUpdateStatus={vi.fn()}
        onDeleteOrder={vi.fn()}
        onWhatsApp={vi.fn()}
      />
    )

    expect(screen.getByText("Salón · Mesa 8")).toBeDefined()
  })

  it("hides Eliminar Orden button when user lacks orders.delete permission", () => {
    mockCan.mockImplementation((p) => p !== "orders.delete")

    render(
      <OrderDetailModal
        order={mockOrder}
        isOpen={true}
        onClose={vi.fn()}
        onUpdateStatus={vi.fn()}
        onDeleteOrder={vi.fn()}
        onWhatsApp={vi.fn()}
      />
    )

    expect(screen.queryByRole("button", { name: /Eliminar Orden/i })).toBeNull()
    // Other manage buttons are still available
    expect(screen.getByRole("button", { name: /🟠 En Cocina/i })).toBeDefined()
  })

  it("hides Editar venta and status transition buttons when user lacks orders.manage permission", () => {
    mockCan.mockImplementation((p) => p !== "orders.manage")

    render(
      <OrderDetailModal
        order={mockOrder}
        isOpen={true}
        onClose={vi.fn()}
        onUpdateStatus={vi.fn()}
        onDeleteOrder={vi.fn()}
        onWhatsApp={vi.fn()}
        onEditOrder={vi.fn()}
      />
    )

    expect(screen.queryByRole("button", { name: /Editar venta/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /🟡 Pendiente/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /🟠 En Cocina/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /🔵 En Reparto/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /🟢 Entregado/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /🔴 Cancelar/i })).toBeNull()
    expect(screen.queryByText(/Cambiar estado de orden:/i)).toBeNull()
    // Delete button is still available since orders.delete is granted
    expect(screen.getByRole("button", { name: /Eliminar Orden/i })).toBeDefined()
  })

  it("hides both status advancers and delete button when user only has orders.view", () => {
    mockCan.mockImplementation((p) => p === "orders.view")

    render(
      <OrderDetailModal
        order={mockOrder}
        isOpen={true}
        onClose={vi.fn()}
        onUpdateStatus={vi.fn()}
        onDeleteOrder={vi.fn()}
        onWhatsApp={vi.fn()}
        onEditOrder={vi.fn()}
      />
    )

    expect(screen.queryByRole("button", { name: /Editar venta/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /Eliminar Orden/i })).toBeNull()
    expect(screen.queryByText(/Cambiar estado de orden:/i)).toBeNull()
    expect(screen.queryByRole("button", { name: /🟠 En Cocina/i })).toBeNull()

    // Read-only customer and order information stays visible
    expect(screen.getByText("Orden #101")).toBeDefined()
    expect(screen.getByText("Carlos Gómez")).toBeDefined()
    expect(screen.getByText("WhatsApp: 3001234567")).toBeDefined()
    expect(screen.getByText("$55.000")).toBeDefined()
    expect(screen.getByRole("button", { name: /Imprimir.*ticket/i })).toBeDefined()
  })

  it("renders Imprimir ticket button and opens OrderTicketModal when clicked", () => {
    render(
      <OrderDetailModal
        order={mockOrder}
        isOpen={true}
        onClose={vi.fn()}
        onUpdateStatus={vi.fn()}
        onDeleteOrder={vi.fn()}
        onWhatsApp={vi.fn()}
      />
    )

    const printBtn = screen.getByRole("button", { name: /Imprimir.*ticket/i })
    expect(printBtn).toBeDefined()
    fireEvent.click(printBtn)

    // OrderTicketModal should now be visible with live preview
    expect(screen.getByText("Imprimir Comanda / Ticket")).toBeDefined()
    expect(screen.getByText(/TICKET DE VENTA \/ DESPACHO/i)).toBeDefined()
  })

  it("calls onPrintOrder callback when provided and clicking Imprimir ticket", () => {
    const onPrintOrder = vi.fn()
    render(
      <OrderDetailModal
        order={mockOrder}
        isOpen={true}
        onClose={vi.fn()}
        onUpdateStatus={vi.fn()}
        onDeleteOrder={vi.fn()}
        onWhatsApp={vi.fn()}
        onPrintOrder={onPrintOrder}
      />
    )

    const printBtn = screen.getByRole("button", { name: /Imprimir.*ticket/i })
    fireEvent.click(printBtn)
    expect(onPrintOrder).toHaveBeenCalledWith(mockOrder)
  })

  it("allows read-only user with orders.view to open/print ticket while hiding mutation buttons", () => {
    mockCan.mockImplementation((p) => p === "orders.view")
    const onPrintOrder = vi.fn()
    const onEditOrder = vi.fn()
    const onDeleteOrder = vi.fn()
    const onUpdateStatus = vi.fn()

    render(
      <OrderDetailModal
        order={mockOrder}
        isOpen={true}
        onClose={vi.fn()}
        onUpdateStatus={onUpdateStatus}
        onDeleteOrder={onDeleteOrder}
        onWhatsApp={vi.fn()}
        onEditOrder={onEditOrder}
        onPrintOrder={onPrintOrder}
      />
    )

    const printBtn = screen.getByRole("button", { name: /Imprimir.*ticket/i })
    expect(printBtn).toBeDefined()
    fireEvent.click(printBtn)
    expect(onPrintOrder).toHaveBeenCalledWith(mockOrder)

    expect(screen.queryByRole("button", { name: /Editar venta/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /Eliminar Orden/i })).toBeNull()
    expect(screen.queryByText(/Cambiar estado de orden:/i)).toBeNull()
  })
})
