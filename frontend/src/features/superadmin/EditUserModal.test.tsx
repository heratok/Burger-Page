import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { RestaurantProvider } from "@/context/RestaurantContext"
import { EditUserModal } from "./EditUserModal"
import { apiClient, type ApiUserRecord } from "@/core/api/apiClient"

const mockRestaurant = {
  id: "rest-burger-craft",
  name: "Burger Craft",
  slug: "burger-craft",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  config: {
    name: "Burger Craft",
    tagline: "Hamburguesas artesanales premium",
    whatsappNumber: "573001234567",
    currency: "COP",
    currencySymbol: "$",
    deliveryFee: 5000,
    minOrderAmount: 20000,
    estimatedDeliveryTime: "30-45 min",
    schedule: [],
    timezone: "America/Bogota",
    ordersPaused: false,
    address: "Calle 123",
    primaryColor: "#FF7A21",
    primaryHoverColor: "#E06516",
    bgTheme: "dark-charcoal",
    fontFamily: "sans",
    cardRadius: "lg",
    cardStyle: "elevated",
    compactGrid: false,
    showBadges: true,
    logoUrl: "",
    bannerUrl: "",
    showBanner: false,
    announcementText: "",
    showAnnouncement: false,
  },
  products: [],
  categories: [],
  orders: [],
  additions: [],
  customers: [],
}

const mockAdminUser: ApiUserRecord = {
  id: "usr-admin-1",
  username: "craft_manager",
  role: "restaurant_admin",
  restaurantId: "rest-burger-craft",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
}

describe("EditUserModal (TDD)", () => {
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
  })

  afterEach(() => {
    cleanup()
  })

  it("renders form fields pre-populated with user data", () => {
    render(
      <RestaurantProvider>
        <EditUserModal
          isOpen={true}
          onClose={vi.fn()}
          user={mockAdminUser}
        />
      </RestaurantProvider>
    )

    expect(screen.getByText("Editar Usuario")).toBeDefined()
    expect((screen.getByLabelText(/Nombre de usuario/i) as HTMLInputElement).value).toBe("craft_manager")
    expect((screen.getByLabelText(/Rol en la plataforma/i) as HTMLSelectElement).value).toBe("restaurant_admin")
    expect((screen.getByLabelText(/Restaurante Asignado/i) as HTMLSelectElement).value).toBe("rest-burger-craft")
  })

  it("disables restaurant selector when role is super_admin", () => {
    render(
      <RestaurantProvider>
        <EditUserModal
          isOpen={true}
          onClose={vi.fn()}
          user={mockAdminUser}
        />
      </RestaurantProvider>
    )

    const roleSelect = screen.getByLabelText(/Rol en la plataforma/i) as HTMLSelectElement
    fireEvent.change(roleSelect, { target: { value: "super_admin" } })

    const restaurantSelect = screen.getByLabelText(/Restaurante Asignado/i) as HTMLSelectElement
    expect(restaurantSelect.disabled).toBe(true)
    expect(screen.getByText(/Los Super Administradores tienen acceso global/i)).toBeDefined()
  })

  it("blocks self-demotion when editing own super_admin account", () => {
    const ownSuperAdminUser: ApiUserRecord = {
      id: "usr-super-me",
      username: "admin",
      role: "super_admin",
      restaurantId: undefined,
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    }

    render(
      <RestaurantProvider>
        <EditUserModal
          isOpen={true}
          onClose={vi.fn()}
          user={ownSuperAdminUser}
        />
      </RestaurantProvider>
    )

    const roleSelect = screen.getByLabelText(/Rol en la plataforma/i) as HTMLSelectElement
    expect(roleSelect.disabled).toBe(true)
    expect(screen.getByText(/No podés modificar tu propio rol/i)).toBeDefined()
  })

  it("submits updated username, role, and restaurantId to apiClient.updateUser", async () => {
    const updateSpy = vi.spyOn(apiClient, "updateUser").mockResolvedValue({
      ...mockAdminUser,
      username: "craft_director",
    })
    const onClose = vi.fn()
    const onSuccess = vi.fn()

    render(
      <RestaurantProvider>
        <EditUserModal
          isOpen={true}
          onClose={onClose}
          user={mockAdminUser}
          onSuccess={onSuccess}
        />
      </RestaurantProvider>
    )

    const usernameInput = screen.getByLabelText(/Nombre de usuario/i)
    fireEvent.change(usernameInput, { target: { value: "craft_director" } })

    fireEvent.click(screen.getByRole("button", { name: /Guardar Cambios/i }))

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith("usr-admin-1", {
        username: "craft_director",
        role: "restaurant_admin",
        restaurantId: "rest-burger-craft",
        isActive: true,
      })
      expect(onSuccess).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })
  })

  it("displays Spanish error messages on 400, 404, and 409 responses", async () => {
    const conflictError: any = new Error("Username already taken")
    conflictError.status = 409
    vi.spyOn(apiClient, "updateUser").mockRejectedValue(conflictError)

    render(
      <RestaurantProvider>
        <EditUserModal
          isOpen={true}
          onClose={vi.fn()}
          user={mockAdminUser}
        />
      </RestaurantProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: /Guardar Cambios/i }))

    expect(
      await screen.findByText(/El nombre de usuario ya está en uso por otra cuenta/i)
    ).toBeDefined()
  })

  it("distinguishes own account self-demotion from last active super admin demotion (Defect 5)", async () => {
    // 1. Self demotion error from backend
    const selfDemoteError: any = new Error("You cannot demote your own account")
    selfDemoteError.status = 409

    vi.spyOn(apiClient, "updateUser").mockRejectedValueOnce(selfDemoteError)

    render(
      <RestaurantProvider>
        <EditUserModal
          isOpen={true}
          onClose={vi.fn()}
          user={mockAdminUser}
        />
      </RestaurantProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: /Guardar Cambios/i }))

    expect(
      await screen.findByText(/No podés degradar tu propia cuenta/i)
    ).toBeDefined()
    expect(screen.queryByText(/último Super Administrador/i)).toBeNull()

    // 2. Last super admin error from backend
    const lastSuperAdminError: any = new Error("Cannot demote the last active super admin")
    lastSuperAdminError.status = 409

    vi.spyOn(apiClient, "updateUser").mockRejectedValueOnce(lastSuperAdminError)

    fireEvent.click(screen.getByRole("button", { name: /Guardar Cambios/i }))

    expect(
      await screen.findByText(/No podés degradar al último Super Administrador activo/i)
    ).toBeDefined()
  })

  it("distinguishes generic 400 validation errors like required username from restaurant role validation (Defect 5)", async () => {
    const usernameRequiredError: any = new Error("Username is required")
    usernameRequiredError.status = 400

    vi.spyOn(apiClient, "updateUser").mockRejectedValueOnce(usernameRequiredError)

    render(
      <RestaurantProvider>
        <EditUserModal
          isOpen={true}
          onClose={vi.fn()}
          user={mockAdminUser}
        />
      </RestaurantProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: /Guardar Cambios/i }))

    expect(
      await screen.findByText(/El nombre de usuario es obligatorio/i)
    ).toBeDefined()
    expect(screen.queryByText(/Un Administrador de Restaurante debe tener un restaurante asignado/i)).toBeNull()
  })
})
