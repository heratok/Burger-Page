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

  it("shows the configured physical address and an accessible 'Cómo llegar' Google Maps link", async () => {
    const rawAddress = "  Calle 85 # 14-32, Bogotá  "
    seedBlankActiveTenant("rest-burger-craft", "burger-craft", { address: rawAddress })
    render(
      <RestaurantProvider>
        <Home />
      </RestaurantProvider>
    )
    await screen.findByPlaceholderText("Buscar en el menú...")

    expect(screen.getByText("Calle 85 # 14-32, Bogotá")).toBeDefined()
    const link = screen.getByRole("link", { name: "Cómo llegar" }) as HTMLAnchorElement
    expect(link.getAttribute("href")).toBe(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Calle 85 # 14-32, Bogotá")}`
    )
    expect(link.getAttribute("target")).toBe("_blank")
    expect(link.getAttribute("rel")).toBe("noopener noreferrer")
  })

  it("renders nothing for address or 'Cómo llegar' when address is empty or whitespace-only", async () => {
    seedBlankActiveTenant("rest-burger-craft", "burger-craft", { address: "   " })
    render(
      <RestaurantProvider>
        <Home />
      </RestaurantProvider>
    )
    await screen.findByPlaceholderText("Buscar en el menú...")

    expect(screen.queryByRole("link", { name: "Cómo llegar" })).toBeNull()
  })

  it("shows estimated delivery time near availability when showBanner is false", async () => {
    seedBlankActiveTenant("rest-burger-craft", "burger-craft", {
      showBanner: false,
      estimatedDeliveryTime: "  35 - 50 min  ",
    })
    render(
      <RestaurantProvider>
        <Home />
      </RestaurantProvider>
    )
    await screen.findByPlaceholderText("Buscar en el menú...")

    expect(screen.getAllByText(/Tiempo estimado de entrega:\s*35 - 50 min/)).toHaveLength(1)
  })

  it("shows estimated delivery time once near availability without duplicating it in the hero banner when showBanner is true", async () => {
    seedBlankActiveTenant("rest-burger-craft", "burger-craft", {
      showBanner: true,
      bannerUrl: "https://example.com/banner.jpg",
      estimatedDeliveryTime: "40 - 55 min",
    })
    render(
      <RestaurantProvider>
        <Home />
      </RestaurantProvider>
    )
    await screen.findByPlaceholderText("Buscar en el menú...")

    expect(screen.getAllByText(/40 - 55 min/)).toHaveLength(1)
    expect(screen.getByText(/Tiempo estimado de entrega:\s*40 - 55 min/)).toBeDefined()
  })

  it("renders nothing for estimated delivery time when it is empty or whitespace-only", async () => {
    seedBlankActiveTenant("rest-burger-craft", "burger-craft", {
      showBanner: false,
      estimatedDeliveryTime: "   ",
    })
    render(
      <RestaurantProvider>
        <Home />
      </RestaurantProvider>
    )
    await screen.findByPlaceholderText("Buscar en el menú...")

    expect(screen.queryByText(/Tiempo estimado de entrega/i)).toBeNull()
  })
})
