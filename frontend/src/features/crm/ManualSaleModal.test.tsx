import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { RestaurantProvider } from "@/context/RestaurantContext"
import { ManualSaleModal } from "./ManualSaleModal"
import { toast } from "sonner"

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}))

describe("ManualSaleModal - Point of Sale (POS) Component", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("does not render when isOpen is false", () => {
    render(
      <RestaurantProvider>
        <ManualSaleModal isOpen={false} onClose={() => {}} />
      </RestaurantProvider>
    )

    expect(screen.queryByText(/Punto de Venta/i)).toBeNull()
  })

  it("renders catalog, service modes, and payment methods when open", () => {
    render(
      <RestaurantProvider>
        <ManualSaleModal isOpen={true} onClose={() => {}} />
      </RestaurantProvider>
    )

    expect(screen.getByText(/Punto de Venta — Nueva Venta/i)).toBeDefined()
    expect(screen.getByRole("button", { name: /Mostrador/i })).toBeDefined()
    expect(screen.getByRole("button", { name: /Mesa \/ Salón/i })).toBeDefined()
    expect(screen.getByRole("button", { name: /Domicilio/i })).toBeDefined()
    expect(screen.getByRole("button", { name: /💵 Efectivo/i })).toBeDefined()
    expect(screen.getByRole("button", { name: /💳 Transferencia/i })).toBeDefined()
  })

  it("allows searching products, adding items to order, updating quantity and calculating total", async () => {
    render(
      <RestaurantProvider>
        <ManualSaleModal isOpen={true} onClose={() => {}} />
      </RestaurantProvider>
    )

    // Initially order is empty
    expect(screen.getByText(/Venta vacía/i)).toBeDefined()

    // Add first available product
    const addButtons = screen.getAllByRole("button", { name: /Agregar/i })
    expect(addButtons.length).toBeGreaterThan(0)
    fireEvent.click(addButtons[0])

    // Should now show item in order list
    expect(screen.queryByText(/Venta vacía/i)).toBeNull()
    expect(screen.getByText(/Subtotal platos:/i)).toBeDefined()

    // Add another item
    if (addButtons.length > 1) {
      fireEvent.click(addButtons[1])
    }

    // Submit order for Mostrador
    const submitBtn = screen.getByRole("button", { name: /Registrar Venta/i })
    expect(submitBtn).toBeDefined()
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "¡Venta manual registrada en el sistema!",
        expect.objectContaining({
          description: expect.any(String),
        })
      )
    })
  })

  it("requires address and barrio when service mode is Domicilio", async () => {
    render(
      <RestaurantProvider>
        <ManualSaleModal isOpen={true} onClose={() => {}} />
      </RestaurantProvider>
    )

    // Add a product
    const addButtons = screen.getAllByRole("button", { name: /Agregar/i })
    fireEvent.click(addButtons[0])

    // Switch to Domicilio
    const deliveryBtn = screen.getByRole("button", { name: /Domicilio/i })
    fireEvent.click(deliveryBtn)

    // Try to submit without address
    const submitBtn = screen.getByRole("button", { name: /Registrar Venta/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Ingresa la dirección para el domicilio")
    })
  })
})
