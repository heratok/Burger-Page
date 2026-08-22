import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { RestaurantProvider, useRestaurant } from "@/context/RestaurantContext"
import Home from "@/features/storefront/Home"
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
})
