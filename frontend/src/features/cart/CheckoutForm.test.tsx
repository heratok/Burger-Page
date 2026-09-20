import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { RestaurantProvider } from "@/context/RestaurantContext"
import CheckoutForm from "./CheckoutForm"
import type { CartItem } from "./cartEngine"
import { toast } from "sonner"

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}))

const mockCartItems: CartItem[] = [
  {
    id: "prod-rosto-1",
    name: "Rosto Clásica Ahumada",
    price: 28000,
    cantidad: 2,
    total: 56000,
    src: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80",
    adiciones: [],
  },
]

describe("CheckoutForm - Direct Sale Flow", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders submit button with 'Registrar venta'", () => {
    render(
      <RestaurantProvider>
        <CheckoutForm
          cartItems={mockCartItems}
          onClose={() => {}}
          onBackToCart={() => {}}
        />
      </RestaurantProvider>
    )

    const submitBtn = screen.getByRole("button", { name: /Registrar venta/i })
    expect(submitBtn).toBeDefined()
    expect(screen.queryByRole("button", { name: /Enviar pedido por WhatsApp/i })).toBeNull()
  })

  it("submits the sale, registers the order in system, shows toast and closes without opening WhatsApp", async () => {
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null)
    const onCloseMock = vi.fn()
    const { apiClient } = await import("@/core/api/apiClient")
    const createOrderSpy = vi.spyOn(apiClient, "createOrder").mockResolvedValue({
      id: "server-checkout-1",
      orderNumber: 3131,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any)

    render(
      <RestaurantProvider>
        <CheckoutForm
          cartItems={mockCartItems}
          onClose={onCloseMock}
          onBackToCart={() => {}}
        />
      </RestaurantProvider>
    )

    // Fill form fields
    fireEvent.change(screen.getByLabelText(/Nombre/i), {
      target: { value: "Carlos Pérez" },
    })
    fireEvent.change(screen.getByLabelText(/Celular/i), {
      target: { value: "3001234567" },
    })
    fireEvent.change(screen.getByLabelText(/Dirección/i), {
      target: { value: "Calle 45 # 12-34" },
    })
    fireEvent.change(screen.getByLabelText(/Barrio/i), {
      target: { value: "El Poblado" },
    })

    // Submit form
    const submitBtn = screen.getByRole("button", { name: /Registrar venta/i })
    fireEvent.click(submitBtn)

    // The sale is registered through addOrder with the form payload, the form
    // closes, and no WhatsApp window opens. CheckoutForm itself never shows a
    // success toast: the outcome toast is owned by addOrder and only fires
    // after the server accepts the order.
    await waitFor(() => {
      expect(createOrderSpy).toHaveBeenCalledTimes(1)
      expect(createOrderSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: {
            name: "Carlos Pérez",
            phone: "3001234567",
            address: "Calle 45 # 12-34",
            barrio: "El Poblado",
          },
          items: [{ productId: "prod-rosto-1", quantity: 2, additions: [] }],
          deliveryFee: 5000,
          paymentMethod: "Efectivo",
        })
      )
      expect(windowOpenSpy).not.toHaveBeenCalled()
      expect(onCloseMock).toHaveBeenCalledTimes(1)
    })

    // addOrder confirms success only after the server accepts the order.
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledTimes(1)
    })
    expect(toast.success).toHaveBeenCalledWith("Orden #3131 registrada", expect.anything())
    expect(toast.success).not.toHaveBeenCalledWith(
      "¡Venta registrada con éxito!",
      expect.objectContaining({
        description: expect.stringContaining("Carlos Pérez"),
      })
    )

    windowOpenSpy.mockRestore()
  })
})
