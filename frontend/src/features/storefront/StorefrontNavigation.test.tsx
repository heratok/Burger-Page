import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { RestaurantProvider } from "@/context/RestaurantContext"
import Home from "@/features/storefront/Home"
import { TenantRepository } from "@/core/storage/TenantRepository"
import { InMemoryStorageAdapter } from "@/core/storage/StorageAdapter"
import { TEST_STORAGE_ENVELOPE } from "@/test/fixtures"

function createTestRepo() {
  const adapter = new InMemoryStorageAdapter()
  const repo = new TenantRepository(adapter)
  repo.saveEnvelope(TEST_STORAGE_ENVELOPE)
  return repo
}

describe("Storefront Navigation & Cart / Checkout Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("navigates correctly: Cart -> Checkout -> Back to Cart -> Seguir comprando -> Catalog", async () => {
    const repo = createTestRepo()
    render(
      <RestaurantProvider repository={repo}>
        <Home />
      </RestaurantProvider>
    )

    // Wait for catalog to load
    const searchInput = await screen.findByPlaceholderText("Buscar en el menú...")
    expect(searchInput).toBeDefined()

    // Open Cart from Navbar button
    const cartButtons = await screen.findAllByRole("button", { name: /Ver orden/i })
    fireEvent.click(cartButtons[0])

    // Cart is open (empty state)
    expect(screen.getByText(/Tu carrito está vacío/i)).toBeDefined()

    // Clicking "Explorar menú" takes user back to catalog
    const exploreBtn = screen.getByRole("button", { name: /Explorar menú/i })
    fireEvent.click(exploreBtn)

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Buscar en el menú...")).toBeDefined()
    })
  })

  it("returns to catalog when clicking 'Seguir comprando' after returning from checkout", async () => {
    const repo = createTestRepo()
    render(
      <RestaurantProvider repository={repo}>
        <Home />
      </RestaurantProvider>
    )

    // Wait for catalog to load
    await screen.findByPlaceholderText("Buscar en el menú...")

    // Add product to open additions modal
    const addButtons = await screen.findAllByRole("button", { name: /Agregar .* al carrito/i })
    expect(addButtons.length).toBeGreaterThan(0)
    fireEvent.click(addButtons[0])

    // In AdditionsModal, click "Agregar · $..."
    const confirmAddBtn = await screen.findByRole("button", { name: /Agregar ·/i })
    fireEvent.click(confirmAddBtn)

    // Open cart via navbar or mobile bar
    const cartButtons = await screen.findAllByRole("button", { name: /Ver orden/i })
    fireEvent.click(cartButtons[0])

    // Verify ShoppingCart is rendered with "Tu pedido"
    expect(await screen.findByRole("heading", { name: /Tu pedido/i })).toBeDefined()

    // Click "Confirmar orden" to proceed to checkout
    const checkoutBtn = screen.getByRole("button", { name: /Confirmar orden/i })
    fireEvent.click(checkoutBtn)

    // Verify CheckoutForm is rendered with "Finalizar pedido"
    expect(await screen.findByRole("heading", { name: /Finalizar pedido/i })).toBeDefined()

    // Click "Volver" to return to cart
    const backBtn = screen.getByRole("button", { name: /Volver/i })
    fireEvent.click(backBtn)

    // Verify ShoppingCart is back with "Tu pedido"
    expect(await screen.findByRole("heading", { name: /Tu pedido/i })).toBeDefined()

    // Click "Seguir comprando"
    const continueShoppingBtn = screen.getByRole("button", { name: /Seguir comprando/i })
    fireEvent.click(continueShoppingBtn)

    // VERIFY: The catalog MUST be shown, and "Finalizar pedido" MUST NOT be shown!
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Buscar en el menú...")).toBeDefined()
      expect(screen.queryByRole("heading", { name: /Finalizar pedido/i })).toBeNull()
      expect(screen.queryByRole("heading", { name: /Tu pedido/i })).toBeNull()
    })
  })

  it("navigates back to catalog when clicking brand/logo in Navbar while in cart", async () => {
    const repo = createTestRepo()
    render(
      <RestaurantProvider repository={repo}>
        <Home />
      </RestaurantProvider>
    )

    await screen.findByPlaceholderText("Buscar en el menú...")

    // Open cart
    const cartButtons = await screen.findAllByRole("button", { name: /Ver orden/i })
    fireEvent.click(cartButtons[0])
    expect(screen.getByText(/Tu carrito está vacío/i)).toBeDefined()

    // Click logo/brand in Navbar
    const brandButton = screen.getByRole("button", { name: /Ir al inicio del menú/i })
    fireEvent.click(brandButton)

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Buscar en el menú...")).toBeDefined()
    })
  })

  it("allows collapsing and expanding category sections, and auto-expands on category pill click", async () => {
    const repo = createTestRepo()
    render(
      <RestaurantProvider repository={repo}>
        <Home />
      </RestaurantProvider>
    )

    await screen.findByPlaceholderText("Buscar en el menú...")

    // In TEST_RESTAURANTS (Burger Craft), category is "Clásicas" with product "Burger Doble Queso"
    expect(screen.getByText("Burger Doble Queso")).toBeDefined()

    // Find the category header button for "Clásicas" (which has aria-controls)
    const allClasicasBtns = screen.getAllByRole("button", { name: /Clásicas/i })
    const clasicasHeaderBtn = allClasicasBtns.find((b) => b.hasAttribute("aria-controls"))!
    expect(clasicasHeaderBtn).toBeDefined()
    expect(clasicasHeaderBtn.getAttribute("aria-expanded")).toBe("true")

    // Click header button to collapse
    fireEvent.click(clasicasHeaderBtn)
    expect(clasicasHeaderBtn.getAttribute("aria-expanded")).toBe("false")
    // Product should now be hidden
    expect(screen.queryByText("Burger Doble Queso")).toBeNull()

    // Click header button again to re-expand
    fireEvent.click(clasicasHeaderBtn)
    expect(clasicasHeaderBtn.getAttribute("aria-expanded")).toBe("true")
    expect(screen.getByText("Burger Doble Queso")).toBeDefined()

    // Collapse again
    fireEvent.click(clasicasHeaderBtn)
    expect(screen.queryByText("Burger Doble Queso")).toBeNull()

    // Click the "Clásicas" pill in the sticky pill slider
    const pills = screen.getAllByRole("button", { name: /^Clásicas/i })
    // The pill button is the one with id or inside the pills container
    const categoryPill = pills.find((p) => p !== clasicasHeaderBtn)
    expect(categoryPill).toBeDefined()
    fireEvent.click(categoryPill!)

    // Category MUST auto-expand!
    expect(clasicasHeaderBtn.getAttribute("aria-expanded")).toBe("true")
    expect(screen.getByText("Burger Doble Queso")).toBeDefined()
  })
})
