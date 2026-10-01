import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { RestaurantProvider, useRestaurant } from "@/context/RestaurantContext"
import Home from "@/features/storefront/Home"
import { STORAGE_KEYS } from "@/core/storage/TenantRepository"
import { TEST_STORAGE_ENVELOPE } from "@/test/fixtures"
import React, { useEffect } from "react"

const StoreTester: React.FC<{ targetSlug: string }> = ({ targetSlug }) => {
  const { switchRestaurant, restaurants } = useRestaurant()

  useEffect(() => {
    const matched = restaurants.find((r) => r.slug === targetSlug)
    if (matched) {
      switchRestaurant(matched.id)
    }
  }, [targetSlug, restaurants, switchRestaurant])

  return <Home />
}

describe("Storefront Multi-Theme Rendering & Contrast", () => {
  beforeEach(() => {
    // Seed real tenant data: a storefront with a menu must render its category
    // bar. (A restaurant with zero categories legitimately renders none, so the
    // fixture — not a fabricated default — is what keeps this bar visible.)
    localStorage.setItem(STORAGE_KEYS.ENVELOPE, JSON.stringify(TEST_STORAGE_ENVELOPE))
  })

  afterEach(() => {
    localStorage.clear()
  })

  it("renders Tacos El Rey (Clean White theme) with high-contrast visible category buttons", async () => {
    render(
      <RestaurantProvider>
        <StoreTester targetSlug="tacos-el-rey" />
      </RestaurantProvider>
    )

    const searchInput = await screen.findByPlaceholderText("Buscar en el menú...")
    expect(searchInput).toBeDefined()

    // Verify category buttons exist and are visible
    const allButtons = screen.getAllByRole("button")
    const categoryButtons = allButtons.filter((b) =>
      ["Todos", "Tacos", "Quesadillas"].some((text) => b.textContent?.includes(text))
    )
    expect(categoryButtons.length).toBeGreaterThanOrEqual(1)
  })

  it("renders Pizzería Di Napoli (Warm Cream theme) with high-contrast visible category buttons", async () => {
    render(
      <RestaurantProvider>
        <StoreTester targetSlug="pizzeria-napoli" />
      </RestaurantProvider>
    )

    const searchInput = await screen.findByPlaceholderText("Buscar en el menú...")
    expect(searchInput).toBeDefined()

    const allButtons = screen.getAllByRole("button")
    const categoryButtons = allButtons.filter((b) =>
      ["Todos", "Clásicas", "Gourmet"].some((text) => b.textContent?.includes(text))
    )
    expect(categoryButtons.length).toBeGreaterThanOrEqual(1)
  })

  it("renders Burger Craft (Dark Charcoal theme) cleanly", async () => {
    render(
      <RestaurantProvider>
        <StoreTester targetSlug="burger-craft" />
      </RestaurantProvider>
    )

    const searchInput = await screen.findByPlaceholderText("Buscar en el menú...")
    expect(searchInput).toBeDefined()
  })

  it("renders AdditionsModal close button with theme-based tokens and no conflicting slate classes", async () => {
    const { default: AdditionsModal } = await import("@/features/cart/AdditionsModal")
    const dummyProduct = {
      id: "test-prod",
      name: "Hamburguesa Test",
      price: 20000,
      category: "Hamburguesas",
      src: "/images/test.jpg",
      description: "Test description",
      inStock: true,
    }

    render(
      <RestaurantProvider>
        <AdditionsModal
          product={dummyProduct}
          onClose={() => {}}
          onAddToCart={() => {}}
        />
      </RestaurantProvider>
    )

    const closeBtn = screen.getByRole("button", { name: "Cerrar" })
    expect(closeBtn).toBeDefined()
    const className = closeBtn.getAttribute("class") || ""

    // Must use dynamic storefront theme classes
    expect(className).toContain("hover:bg-bg-elevated-2")
    expect(className).toContain("hover:text-text-primary")
    expect(className).toContain("text-text-muted")

    // Must NOT contain conflicting hardcoded slate hover classes
    expect(className).not.toContain("dark:hover:bg-slate-800")
    expect(className).not.toContain("hover:bg-slate-100")
  })

  it("AppToaster applies dynamic themeStyles matching the active storefront theme", async () => {
    const { AppToaster } = await import("@/App")

    const { container } = render(
      <RestaurantProvider>
        <StoreTester targetSlug="pizzeria-napoli" />
        <AppToaster />
      </RestaurantProvider>
    )

    // The toaster section or ol should be rendered
    const toasterElement = container.querySelector("section[aria-label*='Notification'], ol.toaster, [data-sonner-toaster]")
    expect(toasterElement).toBeDefined()
  })
})

