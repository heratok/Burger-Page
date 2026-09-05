import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { OrderDetailModal } from "./OrderDetailModal"
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

describe("OrderDetailModal", () => {
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
})
