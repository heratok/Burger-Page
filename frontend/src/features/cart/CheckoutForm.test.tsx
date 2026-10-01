import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { seedBlankActiveTenant } from "@/test/fixtures"
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react"
import { RestaurantProvider, useRestaurant } from "@/context/RestaurantContext"
import CheckoutForm from "./CheckoutForm"
import type { CartItem } from "./cartEngine"
import { toast } from "sonner"
import { isMobileDevice } from "./whatsapp"

vi.mock("./whatsapp", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./whatsapp")>()
  return { ...actual, isMobileDevice: vi.fn(() => false) }
})

interface FakeTab {
  opener: unknown
  closed: boolean
  close: ReturnType<typeof vi.fn>
  document: { open: ReturnType<typeof vi.fn>; write: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }
  location: { href: string }
}

const makeFakeTab = (): FakeTab => ({
  opener: "original-opener",
  closed: false,
  close: vi.fn(),
  document: { open: vi.fn(), write: vi.fn(), close: vi.fn() },
  location: { href: "" },
})

const originalLocation = window.location
let locationAssignMock: ReturnType<typeof vi.fn>

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
    seedBlankActiveTenant("rest-burger-craft", "burger-craft", { whatsappNumber: "573001234567" })
    sessionStorage.clear()
    vi.clearAllMocks()
    vi.mocked(isMobileDevice).mockReturnValue(false)
    locationAssignMock = vi.fn()
    vi.stubGlobal("location", { ...originalLocation, assign: locationAssignMock })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("renders submit button with 'Enviar pedido por WhatsApp'", () => {
    render(
      <RestaurantProvider>
        <CheckoutForm
          cartItems={mockCartItems}
          onClose={() => {}}
          onBackToCart={() => {}}
        />
      </RestaurantProvider>
    )

    const submitBtn = screen.getByRole("button", { name: /Enviar pedido por WhatsApp/i })
    expect(submitBtn).toBeDefined()
  })

  describe("field errors", () => {
    const renderForm = () =>
      render(
        <RestaurantProvider>
          <CheckoutForm cartItems={mockCartItems} onClose={() => {}} onBackToCart={() => {}} />
        </RestaurantProvider>
      )

    it("renders no error element or icon under fields that have no error", () => {
      const { container } = renderForm()
      expect(container.querySelectorAll('[data-slot="field-error"]').length).toBe(0)
      expect(screen.queryAllByRole("alert").length).toBe(0)
      expect(container.querySelectorAll("svg[class~='mt-0.5']").length).toBe(0)
    })

    it("shows the icon and message only under the invalid fields after a failed submit", async () => {
      const { container } = renderForm()
      fireEvent.click(screen.getByRole("button", { name: /Enviar pedido por WhatsApp/i }))
      await waitFor(() => {
        expect(container.querySelectorAll('[data-slot="field-error"]').length).toBeGreaterThan(0)
      })
      const alerts = container.querySelectorAll('[data-slot="field-error"]')
      alerts.forEach((alert) => {
        expect((alert.textContent ?? "").trim().length).toBeGreaterThan(0)
        expect(alert.querySelector('svg[data-icon="inline-start"]')).not.toBeNull()
      })
    })
  })

  it("desktop: opens the tab synchronously before the server answers, then navigates it to WhatsApp and closes the form", async () => {
    const fakeTab = makeFakeTab()
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => fakeTab as unknown as Window)
    const onCloseMock = vi.fn()
    const { apiClient } = await import("@/core/api/apiClient")
    let resolveCreate!: (v: any) => void
    const createOrderSpy = vi.spyOn(apiClient, "createOrder").mockImplementation(
      () => new Promise((res) => { resolveCreate = res }) as any
    )

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
    const submitBtn = screen.getByRole("button", { name: /Enviar pedido por WhatsApp/i })
    fireEvent.click(submitBtn)

    // The tab is opened inside the submit gesture, BEFORE the server answers,
    // so popup blockers see transient user activation.
    await waitFor(() => expect(createOrderSpy).toHaveBeenCalledTimes(1))
    expect(windowOpenSpy).toHaveBeenCalledTimes(1)
    expect(windowOpenSpy).toHaveBeenCalledWith("", "_blank")
    expect(fakeTab.opener).toBeNull()
    expect(fakeTab.location.href).toBe("")
    expect(onCloseMock).not.toHaveBeenCalled()

    resolveCreate({
      id: "server-checkout-1",
      orderNumber: 3131,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    // The sale is registered through addOrder with the form payload, the form
    // closes, and the pending tab navigates to the formatted WhatsApp message.
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
      expect(fakeTab.location.href).toContain("https://wa.me/")
      const callUrl = fakeTab.location.href
      expect(decodeURIComponent(callUrl)).toContain("Carlos Pérez")
      expect(decodeURIComponent(callUrl)).toContain("Calle 45 # 12-34")
      expect(decodeURIComponent(callUrl)).toContain("ROSTO CLÁSICA AHUMADA")
      expect(decodeURIComponent(callUrl)).toContain("Orden: #3131")
      expect(onCloseMock).toHaveBeenCalledTimes(1)
    })

    // addOrder confirms success only after the server accepts the order.
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledTimes(1)
    })
    expect(toast.success).toHaveBeenCalledWith("Orden #3131 registrada", expect.anything())
    expect(windowOpenSpy).toHaveBeenCalledTimes(1)
    expect(locationAssignMock).not.toHaveBeenCalled()
    expect(fakeTab.close).not.toHaveBeenCalled()
  })

  it("desktop: closes the pending tab and keeps the form open when createOrder rejects", async () => {
    const fakeTab = makeFakeTab()
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => fakeTab as unknown as Window)
    const onCloseMock = vi.fn()
    const { apiClient } = await import("@/core/api/apiClient")
    vi.spyOn(apiClient, "createOrder").mockRejectedValue(new Error("Pedido mínimo no alcanzado"))

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
    const submitBtn = screen.getByRole("button", { name: /Enviar pedido por WhatsApp/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    })

    expect(windowOpenSpy).toHaveBeenCalledWith("", "_blank")
    expect(fakeTab.close).toHaveBeenCalledTimes(1)
    expect(fakeTab.location.href).toBe("")
    expect(locationAssignMock).not.toHaveBeenCalled()
    expect(onCloseMock).not.toHaveBeenCalled()
  })

  it("desktop: falls back to same-tab navigation when the popup is blocked", async () => {
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null)
    const onCloseMock = vi.fn()
    const { apiClient } = await import("@/core/api/apiClient")
    vi.spyOn(apiClient, "createOrder").mockResolvedValue({
      id: "server-blocked-1",
      orderNumber: 77,
      status: "pending",
    } as any)

    render(
      <RestaurantProvider>
        <CheckoutForm cartItems={mockCartItems} onClose={onCloseMock} onBackToCart={() => {}} />
      </RestaurantProvider>
    )
    fillForm()
    fireEvent.click(screen.getByRole("button", { name: /Enviar pedido por WhatsApp/i }))

    await waitFor(() => expect(locationAssignMock).toHaveBeenCalledTimes(1))
    expect(windowOpenSpy).toHaveBeenCalledWith("", "_blank")
    expect(locationAssignMock).toHaveBeenCalledWith(expect.stringContaining("https://wa.me/"))
    expect(onCloseMock).toHaveBeenCalledTimes(1)
  })

  it("mobile: does not open a tab and navigates the same tab to WhatsApp", async () => {
    vi.mocked(isMobileDevice).mockReturnValue(true)
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null)
    const onCloseMock = vi.fn()
    const { apiClient } = await import("@/core/api/apiClient")
    vi.spyOn(apiClient, "createOrder").mockResolvedValue({
      id: "server-mobile-1",
      orderNumber: 88,
      status: "pending",
    } as any)

    render(
      <RestaurantProvider>
        <CheckoutForm cartItems={mockCartItems} onClose={onCloseMock} onBackToCart={() => {}} />
      </RestaurantProvider>
    )
    fillForm()
    fireEvent.click(screen.getByRole("button", { name: /Enviar pedido por WhatsApp/i }))

    await waitFor(() => expect(locationAssignMock).toHaveBeenCalledTimes(1))
    expect(windowOpenSpy).not.toHaveBeenCalled()
    expect(locationAssignMock).toHaveBeenCalledWith(expect.stringContaining("https://wa.me/"))
    expect(onCloseMock).toHaveBeenCalledTimes(1)
  })

  it("does not register an order nor open anything when the restaurant has no WhatsApp number", async () => {
    seedBlankActiveTenant("rest-burger-craft", "burger-craft", { whatsappNumber: "   " })
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null)
    const onCloseMock = vi.fn()
    const { apiClient } = await import("@/core/api/apiClient")
    const createOrderSpy = vi.spyOn(apiClient, "createOrder")

    render(
      <RestaurantProvider>
        <CheckoutForm cartItems={mockCartItems} onClose={onCloseMock} onBackToCart={() => {}} />
      </RestaurantProvider>
    )
    fillForm()
    fireEvent.click(screen.getByRole("button", { name: /Enviar pedido por WhatsApp/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Este restaurante aún no tiene WhatsApp configurado. Intenta más tarde."
      )
    })
    expect(createOrderSpy).not.toHaveBeenCalled()
    expect(windowOpenSpy).not.toHaveBeenCalled()
    expect(locationAssignMock).not.toHaveBeenCalled()
    expect(onCloseMock).not.toHaveBeenCalled()
  })

  const fillForm = () => {
    fireEvent.change(screen.getByLabelText(/Nombre/i), { target: { value: "Carlos Pérez" } })
    fireEvent.change(screen.getByLabelText(/Celular/i), { target: { value: "3001234567" } })
    fireEvent.change(screen.getByLabelText(/Dirección/i), { target: { value: "Calle 45 # 12-34" } })
    fireEvent.change(screen.getByLabelText(/Barrio/i), { target: { value: "El Poblado" } })
  }

  it("disables the submit button while the order is in flight and never sends a second clientOrderId (2.1)", async () => {
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null)
    const { apiClient } = await import("@/core/api/apiClient")
    let resolveCreate!: (v: any) => void
    const createOrderSpy = vi.spyOn(apiClient, "createOrder").mockImplementation(
      () => new Promise((res) => { resolveCreate = res }) as any
    )

    render(
      <RestaurantProvider>
        <CheckoutForm cartItems={mockCartItems} onClose={() => {}} onBackToCart={() => {}} />
      </RestaurantProvider>
    )
    fillForm()

    const submitBtn = screen.getByRole("button", { name: /Enviar pedido por WhatsApp/i })
    fireEvent.click(submitBtn)
    await waitFor(() => expect(createOrderSpy).toHaveBeenCalledTimes(1))

    // In flight: the button is disabled and further taps are ignored, even past
    // the context double-click window.
    await waitFor(() => expect((submitBtn as HTMLButtonElement).disabled).toBe(true))
    fireEvent.click(submitBtn)
    fireEvent.submit(submitBtn.closest("form") as HTMLFormElement)
    await new Promise((r) => setTimeout(r, 650))
    fireEvent.click(submitBtn)
    expect(createOrderSpy).toHaveBeenCalledTimes(1)

    resolveCreate({ id: "server-dt-1", orderNumber: 1, status: "pending" })
    await waitFor(() => expect(windowOpenSpy).toHaveBeenCalledTimes(1))
    expect(windowOpenSpy).toHaveBeenCalledWith("", "_blank")
    await waitFor(() => expect(locationAssignMock).toHaveBeenCalledTimes(1))
  })

  it("re-enables the submit button after a server rejection so the customer can fix and retry (2.1)", async () => {
    vi.spyOn(window, "open").mockImplementation(() => makeFakeTab() as unknown as Window)
    const { apiClient } = await import("@/core/api/apiClient")
    vi.spyOn(apiClient, "createOrder").mockRejectedValue(
      Object.assign(new Error("Subtotal 5000 is below minimum order amount 20000"), { status: 400 })
    )
    render(
      <RestaurantProvider>
        <CheckoutForm cartItems={mockCartItems} onClose={() => {}} onBackToCart={() => {}} />
      </RestaurantProvider>
    )
    fillForm()
    const submitBtn = screen.getByRole("button", { name: /Enviar pedido por WhatsApp/i }) as HTMLButtonElement
    fireEvent.click(submitBtn)
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    await waitFor(() => expect(submitBtn.disabled).toBe(false))
  })

  it("opens WhatsApp when the server answers 503 after submit: the sale is pending, not rejected (2.2)", async () => {
    const fakeTab = makeFakeTab()
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => fakeTab as unknown as Window)
    const onCloseMock = vi.fn()
    const { apiClient } = await import("@/core/api/apiClient")
    vi.spyOn(apiClient, "createOrder").mockRejectedValue(
      Object.assign(new Error("API Error: 503 Service Unavailable"), { status: 503 })
    )
    render(
      <RestaurantProvider>
        <CheckoutForm cartItems={mockCartItems} onClose={onCloseMock} onBackToCart={() => {}} />
      </RestaurantProvider>
    )
    fillForm()
    fireEvent.click(screen.getByRole("button", { name: /Enviar pedido por WhatsApp/i }))
    await waitFor(() => expect(onCloseMock).toHaveBeenCalledTimes(1))
    expect(windowOpenSpy).toHaveBeenCalledWith("", "_blank")
    expect(fakeTab.location.href).toContain("https://wa.me/")
    expect(fakeTab.close).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
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
    vi.spyOn(window, "open").mockImplementation(() => null)
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

    fireEvent.click(screen.getByRole("button", { name: /Enviar pedido por WhatsApp/i }))

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
  })

  it("displays min order warning and disables submit button when subtotal is below minimum", () => {
    const blank = {
      id: "rest-burger-craft",
      slug: "burger-craft",
      isActive: true,
      createdAt: new Date().toISOString(),
      config: {
        minOrderAmount: 80000,
      },
      categories: [],
      products: [],
      additions: [],
      orders: [],
      customers: [],
      inventory: [],
      suppliers: [],
    }
    localStorage.setItem(
      "burger_page_platform_v2",
      JSON.stringify({ version: 2, restaurants: [blank] })
    )
    localStorage.setItem("burger_page_active_rest_v2", "rest-burger-craft")

    render(
      <RestaurantProvider>
        <CheckoutForm
          cartItems={mockCartItems}
          onClose={() => {}}
          onBackToCart={() => {}}
        />
      </RestaurantProvider>
    )

    const alert = screen.getByText(/El pedido mínimo es de \$80\.000 \(faltan \$24\.000\)\./i)
    expect(alert).toBeDefined()

    const submitBtn = screen.getByRole("button", { name: /Enviar pedido por WhatsApp/i }) as HTMLButtonElement
    expect(submitBtn.disabled).toBe(true)
  })


  describe("opening hours", () => {
    function seedConfig(config: Record<string, unknown>) {
      const blank = {
        id: "rest-burger-craft",
        slug: "burger-craft",
        isActive: true,
        createdAt: new Date().toISOString(),
        config,
        categories: [],
        products: [],
        additions: [],
        orders: [],
        customers: [],
        inventory: [],
        suppliers: [],
      }
      localStorage.setItem("burger_page_platform_v2", JSON.stringify({ version: 2, restaurants: [blank] }))
      localStorage.setItem("burger_page_active_rest_v2", "rest-burger-craft")
    }

    const renderCheckout = () =>
      render(
        <RestaurantProvider>
          <CheckoutForm cartItems={mockCartItems} onClose={() => {}} onBackToCart={() => {}} />
        </RestaurantProvider>
      )

    it("shows the closed warning and disables submit outside the schedule", () => {
      seedConfig({ schedule: [], timezone: "America/Bogota", ordersPaused: false })
      renderCheckout()
      expect(screen.getByText("Este restaurante se encuentra fuera del horario de atención.")).toBeDefined()
      expect((screen.getByRole("button", { name: /Enviar pedido por WhatsApp/i }) as HTMLButtonElement).disabled).toBe(true)
    })

    it("shows the paused variant when orders are paused", () => {
      seedConfig({ ordersPaused: true })
      renderCheckout()
      expect(screen.getByText("Este restaurante tiene los pedidos en pausa en este momento.")).toBeDefined()
    })

    it("an early submit while closed toasts and never creates the order", async () => {
      seedConfig({ schedule: [], timezone: "America/Bogota", ordersPaused: false })
      const { apiClient } = await import("@/core/api/apiClient")
      const createOrderSpy = vi.spyOn(apiClient, "createOrder")
      renderCheckout()

      fireEvent.change(screen.getByLabelText(/Nombre/i), { target: { value: "Carlos Pérez" } })
      fireEvent.change(screen.getByLabelText(/Celular/i), { target: { value: "3001234567" } })
      fireEvent.change(screen.getByLabelText(/Dirección/i), { target: { value: "Calle 45 # 12-34" } })
      fireEvent.change(screen.getByLabelText(/Barrio/i), { target: { value: "El Poblado" } })
      fireEvent.submit(screen.getByRole("button", { name: /Enviar pedido por WhatsApp/i }).closest("form")!)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Este restaurante se encuentra fuera del horario de atención.")
      })
      expect(createOrderSpy).not.toHaveBeenCalled()
    })

    it("a config without schedule fields (legacy record) stays open", () => {
      seedConfig({})
      renderCheckout()
      expect(screen.queryByText(/fuera del horario/)).toBeNull()
    })
  })

  it("blocks order submission and triggers error toast if onSubmit is called while below minimum order", async () => {
    const blank = {
      id: "rest-burger-craft",
      slug: "burger-craft",
      isActive: true,
      createdAt: new Date().toISOString(),
      config: {
        minOrderAmount: 80000,
      },
      categories: [],
      products: [],
      additions: [],
      orders: [],
      customers: [],
      inventory: [],
      suppliers: [],
    }
    localStorage.setItem(
      "burger_page_platform_v2",
      JSON.stringify({ version: 2, restaurants: [blank] })
    )
    localStorage.setItem("burger_page_active_rest_v2", "rest-burger-craft")

    const { apiClient } = await import("@/core/api/apiClient")
    const createOrderSpy = vi.spyOn(apiClient, "createOrder")

    render(
      <RestaurantProvider>
        <CheckoutForm
          cartItems={mockCartItems}
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

    const submitBtn = screen.getByRole("button", { name: /Enviar pedido por WhatsApp/i })
    fireEvent.submit(submitBtn.closest("form")!)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("El pedido mínimo es de $80.000 (faltan $24.000).")
      )
    })
    expect(createOrderSpy).not.toHaveBeenCalled()
  })
})
