import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react"
import { RestaurantProvider, useRestaurant } from "@/context/RestaurantContext"
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

/** Renders the local order records so tests can assert the recorded payload. */
function OrdersProbe() {
  const { orders } = useRestaurant()
  return <pre data-testid="orders-probe">{JSON.stringify(orders)}</pre>
}

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

  it("includes the delivery fee in the displayed change, summary, and recorded total", async () => {
    // Subtotal 30.000 + delivery fee 5.000 -> total 35.000. Paying 40.000
    // must quote a change of 5.000 (NOT 10.000, which would exclude the fee)
    // and the recorded order must match the displayed charge.
    const cartItems: CartItem[] = [
      {
        id: "prod-rosto-1",
        name: "Rosto Clásica Ahumada",
        price: 30000,
        cantidad: 1,
        total: 30000,
        src: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80",
        adiciones: [],
      },
    ]
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null)
    const { apiClient } = await import("@/core/api/apiClient")
    const createOrderSpy = vi.spyOn(apiClient, "createOrder").mockResolvedValue({
      id: "server-checkout-2",
      orderNumber: 4242,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any)

    render(
      <RestaurantProvider>
        <OrdersProbe />
        <CheckoutForm
          cartItems={cartItems}
          onClose={() => {}}
          onBackToCart={() => {}}
        />
      </RestaurantProvider>
    )

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
    fireEvent.change(screen.getByLabelText(/¿Con cuánto pagas\?/i), {
      target: { value: "40000" },
    })

    // Change is computed over the fee-inclusive total: 40.000 - 35.000 = 5.000.
    const cambioText = screen.getByText(/Tu cambio:/i).textContent
    expect(cambioText).toContain("$5.000")
    expect(cambioText).not.toContain("$10.000")
    expect(screen.queryByText("$10.000")).toBeNull()

    // The checkout summary shows Subtotal (fee excluded), the delivery fee
    // line, and the fee-inclusive final total, mirroring the WhatsApp message.
    const subtotalRow = screen.getByText("Subtotal").closest("li")
    expect(subtotalRow).not.toBeNull()
    expect(within(subtotalRow as HTMLElement).getByText("$30.000")).toBeDefined()
    const feeRow = screen.getByText("Domicilio / Envío").closest("li")
    expect(feeRow).not.toBeNull()
    expect(within(feeRow as HTMLElement).getByText("$5.000")).toBeDefined()
    const totalRow = screen.getByText("Total").closest("li")
    expect(totalRow).not.toBeNull()
    expect(within(totalRow as HTMLElement).getByText("$35.000")).toBeDefined()

    fireEvent.click(screen.getByRole("button", { name: /Registrar venta/i }))

    // The recorded (optimistic) order carries the same charge shown to the
    // customer: subtotal 30.000, fee 5.000, finalTotal 35.000, cambio 5.000.
    await waitFor(() => {
      const orders = JSON.parse(screen.getByTestId("orders-probe").textContent ?? "[]")
      expect(orders.length).toBeGreaterThan(0)
      const recorded = orders[0]
      expect(recorded.total).toBe(30000)
      expect(recorded.deliveryFee).toBe(5000)
      expect(recorded.finalTotal).toBe(35000)
      expect(recorded.cambio).toBe(5000)
    })

    // The backend payload carries the fee-inclusive change/payment amounts.
    await waitFor(() => {
      expect(createOrderSpy).toHaveBeenCalledTimes(1)
      const orderInput = createOrderSpy.mock.calls[0][0]
      expect(orderInput.changeAmount).toBe(5000)
      expect(orderInput.paymentAmount).toBe(40000)
    })

    windowOpenSpy.mockRestore()
  })
})
