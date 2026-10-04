import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"
import { RestaurantProvider } from "@/context/RestaurantContext"
import Home from "@/features/storefront/Home"
import { apiClient } from "@/core/api/apiClient"
import { seedBlankActiveTenant, seedCatalog, TEST_PRODUCTS } from "@/test/fixtures"

function seedWithProducts(overrides = {}) {
  seedBlankActiveTenant("rest-burger-craft", "burger-craft", overrides)
  // The catalog is server state now: it comes from the query cache.
  seedCatalog(TEST_PRODUCTS)
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

  it("picks up a pause made on another device when the tab becomes visible, without losing UI state", async () => {
    seedWithProducts()
    const fetchSpy = vi.spyOn(apiClient, "fetchRestaurant").mockResolvedValue({
      id: "rest-burger-craft",
      slug: "burger-craft",
      ordersPaused: true,
    } as any)
    render(
      <RestaurantProvider>
        <Home />
      </RestaurantProvider>
    )
    const search = (await screen.findByPlaceholderText("Buscar en el menú...")) as HTMLInputElement
    fireEvent.change(search, { target: { value: "a" } })
    expect(screen.getByText("Abierto")).toBeDefined()

    document.dispatchEvent(new Event("visibilitychange"))

    await screen.findByText("Pedidos en pausa")
    expect(fetchSpy).toHaveBeenCalledWith("burger-craft")
    expect(screen.queryByText("Abierto")).toBeNull()
    expect(
      (screen.getByPlaceholderText("Buscar en el menú...") as HTMLInputElement).value
    ).toBe("a")
  })
})
