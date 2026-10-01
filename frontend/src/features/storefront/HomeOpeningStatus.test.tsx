import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"
import { RestaurantProvider } from "@/context/RestaurantContext"
import Home from "@/features/storefront/Home"
import { seedBlankActiveTenant, TEST_PRODUCTS } from "@/test/fixtures"

function seedWithProducts(overrides = {}) {
  seedBlankActiveTenant("rest-burger-craft", "burger-craft", overrides)
  const platform = JSON.parse(localStorage.getItem("burger_page_platform_v2")!)
  platform.restaurants[0].products = TEST_PRODUCTS
  localStorage.setItem("burger_page_platform_v2", JSON.stringify(platform))
}

describe("Home - opening status", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })
  afterEach(cleanup)

  it("shows Cerrado and the paused notice while orders are paused", async () => {
    seedBlankActiveTenant("rest-burger-craft", "burger-craft", { ordersPaused: true })
    render(
      <RestaurantProvider>
        <Home />
      </RestaurantProvider>
    )
    await screen.findByPlaceholderText("Buscar en el menú...")
    expect(screen.getByText("Cerrado")).toBeDefined()
    expect(screen.getByText("Pedidos en pausa")).toBeDefined()
  })

  it("shows Abierto for a store open around the clock (default schedule)", async () => {
    seedBlankActiveTenant()
    render(
      <RestaurantProvider>
        <Home />
      </RestaurantProvider>
    )
    await screen.findByPlaceholderText("Buscar en el menú...")
    expect(screen.getByText("Abierto")).toBeDefined()
  })

  it("keeps the menu browsable but blocks adding while paused, with the notice shown once", async () => {
    seedWithProducts({ ordersPaused: true })
    render(
      <RestaurantProvider>
        <Home />
      </RestaurantProvider>
    )
    await screen.findByPlaceholderText("Buscar en el menú...")
    expect(screen.getAllByText(/no puedes agregar productos/i)).toHaveLength(1)
    expect(screen.queryByRole("button", { name: /Agregar .* al carrito/ })).toBeNull()
    const cards = screen.getAllByRole("button", { name: /Cerrado, no se puede agregar/ })
    expect(cards.length).toBeGreaterThan(0)
    fireEvent.click(cards[0])
    const closedBtn = await screen.findByRole("button", { name: "Cerrado" })
    expect((closedBtn as HTMLButtonElement).disabled).toBe(true)
  })

  it("lets the customer add products while open", async () => {
    seedWithProducts()
    render(
      <RestaurantProvider>
        <Home />
      </RestaurantProvider>
    )
    await screen.findByPlaceholderText("Buscar en el menú...")
    expect(screen.getAllByRole("button", { name: /Agregar .* al carrito/ }).length).toBeGreaterThan(0)
  })
})
