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

    await waitFor(() => {
      expect(windowOpenSpy).not.toHaveBeenCalled()
      expect(toast.success).toHaveBeenCalledWith(
        "¡Venta registrada con éxito!",
        expect.objectContaining({
          description: expect.stringContaining("Carlos Pérez"),
        })
      )
      expect(onCloseMock).toHaveBeenCalledTimes(1)
    })

    windowOpenSpy.mockRestore()
  })
})
