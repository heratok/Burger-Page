import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { RestaurantProvider } from "@/context/RestaurantContext"
import { RestaurantsDirectory } from "./RestaurantsDirectory"
import { apiClient, type DeletedRestaurantRecord } from "@/core/api/apiClient"
import type { RestaurantRecord } from "@/types/restaurant"

const mockRestaurant: RestaurantRecord = {
  id: "rest-burger-craft",
  name: "Burger Craft",
  slug: "burger-craft",
  tagline: "Hamburguesas artesanales premium",
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
  config: {
    name: "Burger Craft",
    tagline: "Hamburguesas artesanales premium",
    logoUrl: "https://example.com/logo.png",
    bannerUrl: "",
    showBanner: false,
    announcementText: "",
    showAnnouncement: false,
    whatsappNumber: "573001234567",
    currency: "USD",
    currencySymbol: "$",
    deliveryFee: 5000,
    minOrderAmount: 20000,
    estimatedDeliveryTime: "30-45 min",
    schedule: [],
    timezone: "UTC",
    ordersPaused: false,
    address: "Calle 123 # 45-67",
    primaryColor: "#FF5722",
    primaryHoverColor: "#E04818",
    bgTheme: "dark-charcoal",
    fontFamily: "sans",
    cardRadius: "lg",
    cardStyle: "elevated",
    compactGrid: false,
    showBadges: true,
  },
  products: [],
  categories: [],
  orders: [],
  additions: [],
  customers: [],
}

const mockDeletedRestaurant: DeletedRestaurantRecord = {
  id: "rest-pizza-old",
  name: "Pizza Nostra",
  slug: "pizza-nostra",
  deletedAt: "2026-02-15T12:00:00.000Z",
}

describe("RestaurantsDirectory - Edit Action (TDD)", () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(
      "burger_page_platform_v2",
      JSON.stringify({
        version: 2,
        restaurants: [mockRestaurant],
      })
    )
    vi.clearAllMocks()
    vi.spyOn(apiClient, "listUsers").mockResolvedValue([])
    vi.spyOn(apiClient, "listDeletedRestaurants").mockResolvedValue([mockDeletedRestaurant])
  })

  afterEach(() => {
    cleanup()
  })

  it("renders an 'Editar' action button for each restaurant in the table", () => {
    render(
      <RestaurantProvider>
        <RestaurantsDirectory />
      </RestaurantProvider>
    )

    const editBtn = screen.getByRole("button", {
      name: `Editar restaurante ${mockRestaurant.config.name}`,
    })
    expect(editBtn).toBeDefined()
    expect(screen.getByText("Editar")).toBeDefined()
  })

  it("opens EditRestaurantModal when 'Editar' is clicked", async () => {
    render(
      <RestaurantProvider>
        <RestaurantsDirectory />
      </RestaurantProvider>
    )

    const editBtn = screen.getByRole("button", {
      name: `Editar restaurante ${mockRestaurant.config.name}`,
    })
    fireEvent.click(editBtn)

    expect(await screen.findByRole("heading", { name: "Editar Restaurante" })).toBeDefined()
    expect(screen.getByDisplayValue("Burger Craft")).toBeDefined()
    expect(screen.getByDisplayValue("burger-craft")).toBeDefined()
  })

  it("switches to 'Eliminados' tab, displays deleted restaurants list, and allows restoring", async () => {
    const restoreSpy = vi.spyOn(apiClient, "restoreRestaurant").mockResolvedValue({
      restaurant: {
        ...mockRestaurant,
        id: "rest-pizza-old",
        name: "Pizza Nostra",
        slug: "pizza-nostra",
        isActive: false,
      },
      renamedUsers: [],
    })

    render(
      <RestaurantProvider>
        <RestaurantsDirectory />
      </RestaurantProvider>
    )

    // Click on Eliminados tab
    const eliminadosTab = screen.getByRole("button", { name: /Eliminados/i })
    fireEvent.click(eliminadosTab)

    expect(await screen.findByText("Pizza Nostra")).toBeDefined()
    expect(screen.getByText("/pizza-nostra")).toBeDefined()

    // Click on Restaurar
    const restoreBtn = screen.getByRole("button", { name: /Restaurar restaurante Pizza Nostra/i })
    fireEvent.click(restoreBtn)

    // Confirm dialog should appear explaining it returns paused and admins keep their status
    expect(
      screen.getByText(/Sus administradores vuelven con el estado que tenían antes de eliminarlo/i)
    ).toBeDefined()

    // Confirm restoration
    const confirmBtn = screen.getByRole("button", { name: /Confirmar Restauración/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(restoreSpy).toHaveBeenCalledWith("rest-pizza-old", {})
    })
  })

  it("handles 409 slug conflict on restore by prompting inline for a new slug and retrying", async () => {
    const conflictError: any = new Error("Slug already taken")
    conflictError.status = 409

    const restoreSpy = vi
      .spyOn(apiClient, "restoreRestaurant")
      .mockRejectedValueOnce(conflictError)
      .mockResolvedValueOnce({
        restaurant: {
          ...mockRestaurant,
          id: "rest-pizza-old",
          name: "Pizza Nostra",
          slug: "pizza-nostra-nueva",
          isActive: false,
        },
        renamedUsers: [{ id: "usr-1", from: "admin_pizza", to: "admin_pizza-restored-1" }],
      })

    render(
      <RestaurantProvider>
        <RestaurantsDirectory />
      </RestaurantProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: /Eliminados/i }))
    expect(await screen.findByText("Pizza Nostra")).toBeDefined()

    fireEvent.click(screen.getByRole("button", { name: /Restaurar restaurante Pizza Nostra/i }))

    // Defect 3: Verify copy specifies admins return with their previous status, not automatically reactivated
    expect(screen.getByText(/Sus administradores vuelven con el estado que tenían antes de eliminarlo/i)).toBeDefined()
    expect(screen.queryByText(/reactivados automáticamente/i)).toBeNull()

    // First attempt fails with 409
    fireEvent.click(screen.getByRole("button", { name: /Confirmar Restauración/i }))

    expect(
      await screen.findByText(/El slug original ya está en uso/i)
    ).toBeDefined()

    // Input new slug
    const slugInput = screen.getByLabelText(/Nuevo slug para restaurar/i)
    fireEvent.change(slugInput, { target: { value: "pizza-nostra-nueva" } })

    // Retry restoration
    fireEvent.click(screen.getByRole("button", { name: /Reintentar Restauración/i }))

    await waitFor(() => {
      expect(restoreSpy).toHaveBeenCalledWith("rest-pizza-old", { slug: "pizza-nostra-nueva" })
    })
  })

  it("reflects the attempted slug in error message when second restore attempt fails with 409 (Defect 8)", async () => {
    const conflictError: any = new Error("Slug already taken")
    conflictError.status = 409

    vi.spyOn(apiClient, "restoreRestaurant")
      .mockRejectedValueOnce(conflictError)
      .mockRejectedValueOnce(conflictError)

    render(
      <RestaurantProvider>
        <RestaurantsDirectory />
      </RestaurantProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: /Eliminados/i }))
    expect(await screen.findByText("Pizza Nostra")).toBeDefined()

    fireEvent.click(screen.getByRole("button", { name: /Restaurar restaurante Pizza Nostra/i }))

    // First attempt fails with original slug
    fireEvent.click(screen.getByRole("button", { name: /Confirmar Restauración/i }))
    expect(await screen.findByText(/El slug original ya está en uso/i)).toBeDefined()

    // User enters a custom new slug
    const slugInput = screen.getByLabelText(/Nuevo slug para restaurar/i)
    fireEvent.change(slugInput, { target: { value: "mi-nuevo-slug" } })

    // Second attempt fails with 409
    fireEvent.click(screen.getByRole("button", { name: /Reintentar Restauración/i }))

    // Message must reflect the attempted slug
    expect(await screen.findByText(/El slug «mi-nuevo-slug» ya está en uso/i)).toBeDefined()
  })
})
