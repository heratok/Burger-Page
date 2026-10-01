import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { RestaurantProvider } from "@/context/RestaurantContext"
import Home from "@/features/storefront/Home"
import { seedBlankActiveTenant } from "@/test/fixtures"

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
})
