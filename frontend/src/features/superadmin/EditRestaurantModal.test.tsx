import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { RestaurantProvider } from "@/context/RestaurantContext"
import { EditRestaurantModal } from "./EditRestaurantModal"
import { apiClient } from "@/core/api/apiClient"
import type { RestaurantRecord } from "@/types/restaurant"

const mockRestaurant: RestaurantRecord = {
  id: "rest-burger-craft",
  slug: "burger-craft",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  config: {
    name: "Burger Craft",
    tagline: "Hamburguesas artesanales premium",
    whatsappNumber: "573001234567",
    primaryColor: "#FF7A21",
    primaryHoverColor: "#E06516",
    logoUrl: "",
    bannerUrl: "",
    showBanner: false,
    announcementText: "",
    showAnnouncement: false,
    currency: "COP",
    currencySymbol: "$",
    deliveryFee: 5000,
    minOrderAmount: 20000,
    estimatedDeliveryTime: "30-45 min",
    schedule: [],
    timezone: "America/Bogota",
    ordersPaused: false,
    address: "Calle 123 # 45-67",
    bgTheme: "dark-charcoal",
    fontFamily: "sans",
    cardRadius: "lg",
    cardStyle: "elevated",
    compactGrid: false,
    showBadges: true,
  },
  categories: ["Hamburguesas"],
  products: [],
  additions: [],
  orders: [],
  customers: [],
}

describe("EditRestaurantModal (TDD)", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem(
      "burger_page_platform_v2",
      JSON.stringify({
        version: 2,
        restaurants: [mockRestaurant],
      })
    )
    vi.clearAllMocks()
    vi.spyOn(apiClient, "listUsers").mockResolvedValue([
      {
        id: "usr-admin-1",
        username: "craft_manager",
        role: "restaurant_admin",
        restaurantId: "rest-burger-craft",
        isActive: true,
      },
      {
        id: "usr-admin-2",
        username: "craft_assistant",
        role: "restaurant_admin",
        restaurantId: "rest-burger-craft",
        isActive: false,
      },
    ])
  })

  afterEach(() => {
    cleanup()
  })

  it("renders form fields (nombre, eslogan, WhatsApp, slug) pre-populated from restaurant", async () => {
    render(
      <RestaurantProvider>
        <EditRestaurantModal
          isOpen={true}
          onClose={vi.fn()}
          restaurant={mockRestaurant}
        />
      </RestaurantProvider>
    )

    expect(screen.getByText(/Editar Restaurante/i)).toBeDefined()
    expect((screen.getByLabelText(/Nombre del Restaurante/i) as HTMLInputElement).value).toBe("Burger Craft")
    expect((screen.getByLabelText(/Eslogan/i) as HTMLInputElement).value).toBe("Hamburguesas artesanales premium")
    expect((screen.getByLabelText(/WhatsApp/i) as HTMLInputElement).value).toBe("573001234567")
    expect((screen.getByLabelText(/Slug \/ URL Pública/i) as HTMLInputElement).value).toBe("burger-craft")
    expect((screen.getByLabelText(/Zona Horaria/i) as HTMLSelectElement).value).toBe("America/Bogota")
    expect((screen.getByLabelText(/^Moneda/i) as HTMLSelectElement).value).toBe("COP")
    expect((screen.getByLabelText(/Símbolo/i) as HTMLInputElement).value).toBe("$")
  })

  it("warns that old store links and QR codes stop working when slug is changed", async () => {
    render(
      <RestaurantProvider>
        <EditRestaurantModal
          isOpen={true}
          onClose={vi.fn()}
          restaurant={mockRestaurant}
        />
      </RestaurantProvider>
    )

    const slugInput = screen.getByLabelText(/Slug \/ URL Pública/i)
    fireEvent.change(slugInput, { target: { value: "burger-craft-nuevo" } })

    expect(
      screen.getByText(/Al cambiar el slug se actualizará la URL de la tienda pública/i)
    ).toBeDefined()
  })

  it("validates slug format according to backend rules", async () => {
    render(
      <RestaurantProvider>
        <EditRestaurantModal
          isOpen={true}
          onClose={vi.fn()}
          restaurant={mockRestaurant}
        />
      </RestaurantProvider>
    )

    const slugInput = screen.getByLabelText(/Slug \/ URL Pública/i)
    fireEvent.change(slugInput, { target: { value: "invalid slug with spaces!" } })

    fireEvent.click(screen.getByRole("button", { name: /Guardar Cambios/i }))

    expect(
      await screen.findByText(/El slug solo puede contener letras minúsculas, números y guiones/i)
    ).toBeDefined()
  })

  it("saves restaurant changes via update API, refreshes restaurants, and closes modal", async () => {
    const updateSpy = vi.spyOn(apiClient, "updateRestaurant").mockResolvedValue({
      ...mockRestaurant,
      name: "Burger Craft Actualizado",
    } as any)
    const onCloseMock = vi.fn()
    const onSavedMock = vi.fn()

    render(
      <RestaurantProvider>
        <EditRestaurantModal
          isOpen={true}
          onClose={onCloseMock}
          restaurant={mockRestaurant}
          onSaved={onSavedMock}
        />
      </RestaurantProvider>
    )

    const nameInput = screen.getByLabelText(/Nombre del Restaurante/i)
    fireEvent.change(nameInput, { target: { value: "Burger Craft Actualizado" } })

    fireEvent.click(screen.getByRole("button", { name: /Guardar Cambios/i }))

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith("rest-burger-craft", {
        name: "Burger Craft Actualizado",
        tagline: "Hamburguesas artesanales premium",
        whatsappNumber: "573001234567",
        slug: "burger-craft",
        timezone: "America/Bogota",
        currency: "COP",
        currencySymbol: "$",
      })
      expect(onSavedMock).toHaveBeenCalled()
      expect(onCloseMock).toHaveBeenCalled()
    })
  })

  it("displays 409 conflict error when slug is already taken", async () => {
    const conflictError: any = new Error("Restaurant with slug \"burger-craft-taken\" already exists")
    conflictError.status = 409
    vi.spyOn(apiClient, "updateRestaurant").mockRejectedValue(conflictError)

    render(
      <RestaurantProvider>
        <EditRestaurantModal
          isOpen={true}
          onClose={vi.fn()}
          restaurant={mockRestaurant}
        />
      </RestaurantProvider>
    )

    const slugInput = screen.getByLabelText(/Slug \/ URL Pública/i)
    fireEvent.change(slugInput, { target: { value: "burger-craft-taken" } })

    fireEvent.click(screen.getByRole("button", { name: /Guardar Cambios/i }))

    expect(
      await screen.findByText(/El slug ya está en uso por otro restaurante/i)
    ).toBeDefined()
  })

  it("lists restaurant administrators from GET /api/users?restaurantId=<id> with active state", async () => {
    render(
      <RestaurantProvider>
        <EditRestaurantModal
          isOpen={true}
          onClose={vi.fn()}
          restaurant={mockRestaurant}
        />
      </RestaurantProvider>
    )

    expect(screen.getByText("Administradores de este restaurante")).toBeDefined()
    expect(await screen.findByText("craft_manager")).toBeDefined()
    expect(screen.getByText("craft_assistant")).toBeDefined()

    expect(screen.getByText("Activo")).toBeDefined()
    expect(screen.getByText("Inactivo")).toBeDefined()
  })

  it("supports administrator lifecycle actions (toggle active, reset password, delete)", async () => {
    const setActiveSpy = vi.spyOn(apiClient, "setUserActive").mockResolvedValue({
      id: "usr-admin-1",
      username: "craft_manager",
      role: "restaurant_admin",
      restaurantId: "rest-burger-craft",
      isActive: false,
    })
    const resetSpy = vi.spyOn(apiClient, "resetUserPassword").mockResolvedValue({
      temporaryPassword: "newTempPass999",
    })
    const deleteSpy = vi.spyOn(apiClient, "deleteUser").mockResolvedValue()

    render(
      <RestaurantProvider>
        <EditRestaurantModal
          isOpen={true}
          onClose={vi.fn()}
          restaurant={mockRestaurant}
        />
      </RestaurantProvider>
    )

    await screen.findByText("craft_manager")

    // 1. Toggle active
    const toggleBtn = screen.getByRole("button", { name: /Desactivar usuario craft_manager/i })
    fireEvent.click(toggleBtn)
    await waitFor(() => {
      expect(setActiveSpy).toHaveBeenCalledWith("usr-admin-1", false)
    })

    // 2. Reset password
    const resetBtn = screen.getByRole("button", { name: /Restablecer contraseña de craft_manager/i })
    fireEvent.click(resetBtn)
    await waitFor(() => {
      expect(resetSpy).toHaveBeenCalledWith("usr-admin-1")
    })
    expect(await screen.findByText("newTempPass999")).toBeDefined()

    // Close reset modal
    fireEvent.click(screen.getByRole("button", { name: /Ya la copié, cerrar/i }))

    // 3. Delete user
    const deleteBtn = screen.getByRole("button", { name: /Eliminar usuario craft_manager/i })
    fireEvent.click(deleteBtn)

    expect(await screen.findByText(/¿Eliminar usuario\?/i)).toBeDefined()
    const confirmDeleteBtn = screen.getByRole("button", { name: /^Eliminar usuario$/i })
    fireEvent.click(confirmDeleteBtn)

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith("usr-admin-1")
    })
  })

  it("opens CreateUserModal with prefilled restaurant when clicking '+ Agregar administrador'", async () => {
    render(
      <RestaurantProvider>
        <EditRestaurantModal
          isOpen={true}
          onClose={vi.fn()}
          restaurant={mockRestaurant}
        />
      </RestaurantProvider>
    )

    await screen.findByText("craft_manager")

    const addAdminBtn = screen.getByRole("button", { name: /\+ Agregar administrador/i })
    fireEvent.click(addAdminBtn)

    expect(await screen.findByRole("heading", { name: /Crear Usuario/i })).toBeDefined()
    expect(screen.getByDisplayValue("Burger Craft (/burger-craft)")).toBeDefined()
  })

  it("opens EditUserModal when clicking edit on an administrator row", async () => {
    render(
      <RestaurantProvider>
        <EditRestaurantModal
          isOpen={true}
          onClose={vi.fn()}
          restaurant={mockRestaurant}
        />
      </RestaurantProvider>
    )

    await screen.findByText("craft_manager")

    const editUserBtn = screen.getByRole("button", { name: /Editar usuario craft_manager/i })
    fireEvent.click(editUserBtn)

    expect(await screen.findByRole("heading", { name: /Editar Usuario/i })).toBeDefined()
    expect(screen.getByDisplayValue("craft_manager")).toBeDefined()
  })

  it("shows Spanish validation error when name is whitespace-only", async () => {
    render(
      <RestaurantProvider>
        <EditRestaurantModal
          isOpen={true}
          onClose={vi.fn()}
          restaurant={mockRestaurant}
        />
      </RestaurantProvider>
    )

    fireEvent.change(screen.getByLabelText(/Nombre del Restaurante/i), {
      target: { value: "    " },
    })

    fireEvent.click(screen.getByRole("button", { name: /Guardar Cambios/i }))

    expect(
      await screen.findByText(/El nombre del restaurante no puede estar vacío ni contener solo espacios/i)
    ).toBeDefined()
  })

  it("shows Spanish validation error when slug is reserved ('templates' or 'deleted')", async () => {
    render(
      <RestaurantProvider>
        <EditRestaurantModal
          isOpen={true}
          onClose={vi.fn()}
          restaurant={mockRestaurant}
        />
      </RestaurantProvider>
    )

    fireEvent.change(screen.getByLabelText(/Slug \/ URL Pública/i), {
      target: { value: "deleted" },
    })

    fireEvent.click(screen.getByRole("button", { name: /Guardar Cambios/i }))

    expect(
      await screen.findByText(/El slug «deleted» está reservado por el sistema. Por favor, elegí otro slug/i)
    ).toBeDefined()
  })

  it("shows clear Spanish error when update returns 409 for taken slug", async () => {
    const error409: any = new Error("Restaurant with slug 'other-place' already exists")
    error409.status = 409

    vi.spyOn(apiClient, "updateRestaurant").mockRejectedValue(error409)

    render(
      <RestaurantProvider>
        <EditRestaurantModal
          isOpen={true}
          onClose={vi.fn()}
          restaurant={mockRestaurant}
        />
      </RestaurantProvider>
    )

    fireEvent.change(screen.getByLabelText(/Slug \/ URL Pública/i), {
      target: { value: "other-place" },
    })

    fireEvent.click(screen.getByRole("button", { name: /Guardar Cambios/i }))

    expect(
      await screen.findByText(/El slug ya está en uso por otro restaurante \(incluso si está pausado\)/i)
    ).toBeDefined()
  })
})
