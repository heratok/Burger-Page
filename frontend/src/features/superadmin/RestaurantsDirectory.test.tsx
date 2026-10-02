import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"
import { RestaurantProvider } from "@/context/RestaurantContext"
import { RestaurantsDirectory } from "./RestaurantsDirectory"
import { apiClient } from "@/core/api/apiClient"
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
})
