import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { RestaurantProvider } from "@/context/RestaurantContext"
import { CreateRestaurantModal } from "./CreateRestaurantModal"
import { apiClient } from "@/core/api/apiClient"
import type { RestaurantTemplateSummary } from "@burger-page/contracts"

describe("CreateRestaurantModal (TDD)", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  const mockTemplates: RestaurantTemplateSummary[] = [
    { id: "burger", name: "Hamburguesería", description: "Hamburguesas artesanales y combos", productCount: 6, additionCount: 7 },
    { id: "pizza", name: "Pizzería", description: "Pizzas clásicas e ingredientes", productCount: 4, additionCount: 5 },
    { id: "tacos", name: "Taquería", description: "Tacos tradicionales y salsas", productCount: 3, additionCount: 4 },
    { id: "blank", name: "En Blanco", description: "Menú vacío desde cero", productCount: 0, additionCount: 0 },
  ]

  it("renders form fields correctly when open, including timezone and currency defaults", async () => {
    vi.spyOn(apiClient, "listRestaurantTemplates").mockResolvedValue(mockTemplates)

    render(
      <RestaurantProvider>
        <CreateRestaurantModal isOpen={true} onClose={vi.fn()} />
      </RestaurantProvider>
    )

    expect(screen.getByText(/Dar de Alta Nuevo Restaurante/i)).toBeDefined()
    expect(screen.getByLabelText(/Nombre del Restaurante/i)).toBeDefined()
    expect(screen.getByLabelText(/Slug \/ URL Pública/i)).toBeDefined()
    expect(screen.getByLabelText(/Usuario Admin/i)).toBeDefined()
    expect(screen.getByLabelText(/Clave Admin/i)).toBeDefined()
    expect((screen.getByLabelText(/Zona Horaria/i) as HTMLSelectElement).value).toBe("America/Bogota")
    expect((screen.getByLabelText(/^Moneda/i) as HTMLSelectElement).value).toBe("COP")
    expect((screen.getByLabelText(/Símbolo/i) as HTMLInputElement).value).toBe("$")
  })

  it("loads and displays dynamic templates with counts and sample dish note", async () => {
    vi.spyOn(apiClient, "listRestaurantTemplates").mockResolvedValue(mockTemplates)

    render(
      <RestaurantProvider>
        <CreateRestaurantModal isOpen={true} onClose={vi.fn()} />
      </RestaurantProvider>
    )

    await waitFor(() => {
      expect(screen.getByText("Pizzería")).toBeDefined()
    })

    expect(screen.getByText(/4 platos \+ 5 adicionales/i)).toBeDefined()
    expect(screen.getByText(/Los platos de muestra se crean automáticamente y podrás editarlos/i)).toBeDefined()
  })

  it("submits templateType, timezone, currency, and currencySymbol to createRestaurant API", async () => {
    vi.spyOn(apiClient, "listRestaurantTemplates").mockResolvedValue(mockTemplates)
    const createSpy = vi.spyOn(apiClient, "createRestaurant").mockResolvedValue({
      id: "rest-pizza-1",
      slug: "pizza-napoli",
      name: "Pizza Napoli",
    } as any)

    render(
      <RestaurantProvider>
        <CreateRestaurantModal isOpen={true} onClose={vi.fn()} />
      </RestaurantProvider>
    )

    await waitFor(() => {
      expect(screen.getByText("Pizzería")).toBeDefined()
    })

    fireEvent.change(screen.getByLabelText(/Nombre del Restaurante/i), {
      target: { value: "Pizza Napoli" },
    })

    // Select Pizzeria template
    fireEvent.click(screen.getByText("Pizzería"))

    // Change currency to USD
    fireEvent.change(screen.getByLabelText(/^Moneda/i), {
      target: { value: "USD" },
    })

    // Change timezone
    fireEvent.change(screen.getByLabelText(/Zona Horaria/i), {
      target: { value: "America/New_York" },
    })

    fireEvent.click(screen.getByRole("button", { name: /Crear Restaurante/i }))

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Pizza Napoli",
          slug: "pizza-napoli",
          templateType: "pizza",
          timezone: "America/New_York",
          currency: "USD",
          currencySymbol: "$",
        })
      )
    })
  })

  it("validates that admin password must be at least 8 characters if provided", async () => {
    render(
      <RestaurantProvider>
        <CreateRestaurantModal isOpen={true} onClose={vi.fn()} />
      </RestaurantProvider>
    )

    fireEvent.change(screen.getByLabelText(/Nombre del Restaurante/i), {
      target: { value: "Burger Queen" },
    })
    fireEvent.change(screen.getByLabelText(/Clave Admin/i), {
      target: { value: "short" },
    })

    fireEvent.click(screen.getByRole("button", { name: /Crear Restaurante/i }))

    expect(
      await screen.findByText(/La contraseña debe tener al menos 8 caracteres/i)
    ).toBeDefined()
  })

  it("surfaces returned admin credentials with copy buttons once restaurant is created", async () => {
    const createSpy = vi.spyOn(apiClient, "createRestaurant").mockResolvedValue({
      id: "rest-new-123",
      slug: "burger-queen",
      name: "Burger Queen",
      adminUsername: "admin_burgerqueen",
      adminPassword: "generatedTempPass123",
    } as any)

    const onCloseMock = vi.fn()

    render(
      <RestaurantProvider>
        <CreateRestaurantModal isOpen={true} onClose={onCloseMock} />
      </RestaurantProvider>
    )

    fireEvent.change(screen.getByLabelText(/Nombre del Restaurante/i), {
      target: { value: "Burger Queen" },
    })
    fireEvent.change(screen.getByLabelText(/Clave Admin/i), {
      target: { value: "securePassword123" },
    })

    fireEvent.click(screen.getByRole("button", { name: /Crear Restaurante/i }))

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalled()
    })

    // Credentials screen should be shown
    expect(await screen.findByText(/Credenciales del Administrador/i)).toBeDefined()
    expect(screen.getByText("admin_burgerqueen")).toBeDefined()
    expect(screen.getByText("generatedTempPass123")).toBeDefined()
    expect(screen.getByText(/primer inicio de sesión/i)).toBeDefined()

    // Finish button should close the modal
    const closeBtn = screen.getByRole("button", { name: /Ya copié las credenciales, cerrar/i })
    fireEvent.click(closeBtn)
    expect(onCloseMock).toHaveBeenCalled()
  })

  it("handles 409 conflict when admin username is taken and allows editing username", async () => {
    const error409: any = new Error("Username already exists")
    error409.status = 409

    vi.spyOn(apiClient, "createRestaurant").mockRejectedValue(error409)

    render(
      <RestaurantProvider>
        <CreateRestaurantModal isOpen={true} onClose={vi.fn()} />
      </RestaurantProvider>
    )

    fireEvent.change(screen.getByLabelText(/Nombre del Restaurante/i), {
      target: { value: "Burger Queen" },
    })
    fireEvent.change(screen.getByLabelText(/Usuario Admin/i), {
      target: { value: "taken_user" },
    })

    fireEvent.click(screen.getByRole("button", { name: /Crear Restaurante/i }))

    expect(
      await screen.findByText(/El nombre de usuario administrador ya está en uso/i)
    ).toBeDefined()

    // Preserves values in form so user can edit
    expect((screen.getByLabelText(/Usuario Admin/i) as HTMLInputElement).value).toBe("taken_user")
  })

  it("shows manual copy toast when clipboard writeText rejects in credentials view", async () => {
    const { toast } = await import("sonner")
    const toastErrorSpy = vi.spyOn(toast, "error")

    vi.spyOn(apiClient, "createRestaurant").mockResolvedValue({
      id: "rest-new-123",
      slug: "burger-queen",
      name: "Burger Queen",
      adminUsername: "admin_burgerqueen",
      adminPassword: "generatedTempPass123",
    } as any)

    const writeTextMock = vi.fn().mockRejectedValue(new Error("Clipboard denied"))
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    })

    render(
      <RestaurantProvider>
        <CreateRestaurantModal isOpen={true} onClose={vi.fn()} />
      </RestaurantProvider>
    )

    fireEvent.change(screen.getByLabelText(/Nombre del Restaurante/i), {
      target: { value: "Burger Queen" },
    })
    fireEvent.click(screen.getByRole("button", { name: /Crear Restaurante/i }))

    expect(await screen.findByText(/Credenciales del Administrador/i)).toBeDefined()

    const copyPassBtn = screen.getByRole("button", { name: /Copiar clave provisional/i })
    fireEvent.click(copyPassBtn)

    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("No se pudo copiar automáticamente")
      )
    })
  })

  it("restricts currency select to supportedCurrencies when a template with sample dishes is selected and displays explanation", async () => {
    const templatesWithCurrencies: RestaurantTemplateSummary[] = [
      { id: "burger", name: "Hamburguesería", description: "Hamburguesas artesanales", productCount: 6, additionCount: 7, supportedCurrencies: ["COP", "USD", "EUR"] },
      { id: "blank", name: "En Blanco", description: "Menú vacío desde cero", productCount: 0, additionCount: 0, supportedCurrencies: null },
    ]
    vi.spyOn(apiClient, "listRestaurantTemplates").mockResolvedValue(templatesWithCurrencies)

    render(
      <RestaurantProvider>
        <CreateRestaurantModal isOpen={true} onClose={vi.fn()} />
      </RestaurantProvider>
    )

    await waitFor(() => {
      expect(screen.getByText("Hamburguesería")).toBeDefined()
    })

    // With burger template selected, currency select should only have COP, USD, EUR
    const currencySelect = screen.getByLabelText(/^Moneda/i) as HTMLSelectElement
    const options = Array.from(currencySelect.options).map((o) => o.value)
    expect(options).toEqual(["COP", "USD", "EUR"])
    expect(screen.getByText(/Los platos de ejemplo de esta plantilla tienen precios calculados para las monedas admitidas/i)).toBeDefined()

    // Switch to blank template
    fireEvent.click(screen.getByText("En Blanco"))

    // Blank allows any currency
    const allOptions = Array.from(currencySelect.options).map((o) => o.value)
    expect(allOptions.length).toBeGreaterThan(5)
    expect(allOptions).toContain("BOB")
    expect(screen.getByText(/La plantilla «En Blanco» admite cualquier moneda disponible/i)).toBeDefined()
  })

  it("resets currency to supported currency when switching to a template that does not support the current currency", async () => {
    const templatesWithCurrencies: RestaurantTemplateSummary[] = [
      { id: "burger", name: "Hamburguesería", description: "Hamburguesas artesanales", productCount: 6, additionCount: 7, supportedCurrencies: ["COP", "USD"] },
      { id: "blank", name: "En Blanco", description: "Menú vacío desde cero", productCount: 0, additionCount: 0, supportedCurrencies: null },
    ]
    vi.spyOn(apiClient, "listRestaurantTemplates").mockResolvedValue(templatesWithCurrencies)

    render(
      <RestaurantProvider>
        <CreateRestaurantModal isOpen={true} onClose={vi.fn()} />
      </RestaurantProvider>
    )

    await waitFor(() => {
      expect(screen.getByText("En Blanco")).toBeDefined()
    })

    // Select blank
    fireEvent.click(screen.getByText("En Blanco"))
    // Select BOB currency
    const currencySelect = screen.getByLabelText(/^Moneda/i) as HTMLSelectElement
    fireEvent.change(currencySelect, { target: { value: "BOB" } })
    expect(currencySelect.value).toBe("BOB")

    // Now switch back to burger (which only supports COP, USD)
    fireEvent.click(screen.getByText("Hamburguesería"))

    // Currency should have auto-reset to COP
    await waitFor(() => {
      expect((screen.getByLabelText(/^Moneda/i) as HTMLSelectElement).value).toBe("COP")
    })
  })

  it("shows Spanish validation error when name is whitespace-only", async () => {
    render(
      <RestaurantProvider>
        <CreateRestaurantModal isOpen={true} onClose={vi.fn()} />
      </RestaurantProvider>
    )

    fireEvent.change(screen.getByLabelText(/Nombre del Restaurante/i), {
      target: { value: "    " },
    })
    fireEvent.change(screen.getByLabelText(/Slug \/ URL Pública/i), {
      target: { value: "mi-restaurante" },
    })

    fireEvent.click(screen.getByRole("button", { name: /Crear Restaurante/i }))

    expect(
      await screen.findByText(/El nombre del restaurante no puede estar vacío ni contener solo espacios/i)
    ).toBeDefined()
  })

  it("shows Spanish validation error when slug is reserved ('templates' or 'deleted')", async () => {
    render(
      <RestaurantProvider>
        <CreateRestaurantModal isOpen={true} onClose={vi.fn()} />
      </RestaurantProvider>
    )

    fireEvent.change(screen.getByLabelText(/Nombre del Restaurante/i), {
      target: { value: "Mi Restaurante" },
    })
    fireEvent.change(screen.getByLabelText(/Slug \/ URL Pública/i), {
      target: { value: "templates" },
    })

    fireEvent.click(screen.getByRole("button", { name: /Crear Restaurante/i }))

    expect(
      await screen.findByText(/El slug «templates» está reservado por el sistema. Por favor, elegí otro slug/i)
    ).toBeDefined()
  })

  it("shows clear Spanish error when backend returns 409 for taken slug", async () => {
    const error409: any = new Error("Restaurant with slug 'burger-king' already exists")
    error409.status = 409

    vi.spyOn(apiClient, "createRestaurant").mockRejectedValue(error409)

    render(
      <RestaurantProvider>
        <CreateRestaurantModal isOpen={true} onClose={vi.fn()} />
      </RestaurantProvider>
    )

    fireEvent.change(screen.getByLabelText(/Nombre del Restaurante/i), {
      target: { value: "Burger King" },
    })
    fireEvent.change(screen.getByLabelText(/Slug \/ URL Pública/i), {
      target: { value: "burger-king" },
    })

    fireEvent.click(screen.getByRole("button", { name: /Crear Restaurante/i }))

    expect(
      await screen.findByText(/El slug ya está en uso por otro restaurante \(incluso si está pausado\)/i)
    ).toBeDefined()
  })

  it("shows skeleton / neutral loading state without hardcoded counts while templates are loading (Defect 4)", () => {
    vi.spyOn(apiClient, "listRestaurantTemplates").mockReturnValue(new Promise(() => {}))

    render(
      <RestaurantProvider>
        <CreateRestaurantModal isOpen={true} onClose={vi.fn()} />
      </RestaurantProvider>
    )

    expect(screen.getByText(/Cargando plantillas/i)).toBeDefined()
    // Must NOT show any hardcoded numbers
    expect(screen.queryByText(/6 platos/i)).toBeNull()
    expect(screen.queryByText(/4 platos/i)).toBeNull()
    expect(screen.queryByText(/3 platos/i)).toBeNull()
  })

  it("shows template names without counts and a retry button if template API fails (Defect 4)", async () => {
    const listSpy = vi.spyOn(apiClient, "listRestaurantTemplates").mockRejectedValue(new Error("Network Error"))

    render(
      <RestaurantProvider>
        <CreateRestaurantModal isOpen={true} onClose={vi.fn()} />
      </RestaurantProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Reintentar/i })).toBeDefined()
    })

    // Template options are visible so user can still select one
    expect(screen.getByText(/Hamburguesería/i)).toBeDefined()
    expect(screen.getByText(/Pizzería/i)).toBeDefined()

    // Must NOT display any hardcoded counts
    expect(screen.queryByText(/\d+\s*platos/i)).toBeNull()
    expect(screen.queryByText(/\d+\s*adicionales/i)).toBeNull()

    // Clicking retry attempts to fetch templates again
    listSpy.mockResolvedValueOnce(mockTemplates)
    fireEvent.click(screen.getByRole("button", { name: /Reintentar/i }))

    await waitFor(() => {
      expect(screen.getByText(/4 platos \+ 5 adicionales/i)).toBeDefined()
    })
  })
})

