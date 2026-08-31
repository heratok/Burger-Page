import React from "react"
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import AdditionsModal from "./AdditionsModal"
import { RestaurantProvider } from "@/context/RestaurantContext"
import type { MenuItem } from "@/types/restaurant"

describe("AdditionsModal Fallback Behavior", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  const dummyProduct: MenuItem = {
    id: "prod-1",
    name: "Hamburguesa Clásica",
    price: 25000,
    category: "Platos Principales",
    src: "/images/classic.jpg",
    description: "Carne 150g, lechuga, tomate",
    inStock: true,
  }

  it("renders without additions when storeAdditions and product.additions are empty (no hardcoded mock items)", () => {
    render(
      <RestaurantProvider>
        <AdditionsModal
          product={dummyProduct}
          onClose={() => {}}
          onAddToCart={() => {}}
        />
      </RestaurantProvider>
    )

    // Ensure dialog renders product info
    expect(screen.getByText("Hamburguesa Clásica")).toBeDefined()
    expect(screen.getByText("Carne 150g, lechuga, tomate")).toBeDefined()

    // Ensure NO mock/hardcoded additions ("Papas Fritas", "Cebolla Caramelizada", "Extra Queso", "Tocineta") are rendered
    expect(screen.queryByText("Papas Fritas")).toBeNull()
    expect(screen.queryByText("Cebolla Caramelizada")).toBeNull()
    expect(screen.queryByText("Extra Queso")).toBeNull()
    expect(screen.queryByText("Tocineta")).toBeNull()
    expect(screen.queryByText("Adiciones")).toBeNull()
  })

  it("renders legacy string additions with price 0 when product has legacy additions array", () => {
    const productWithLegacyAdditions: any = {
      ...dummyProduct,
      additions: ["Tocineta Ahumada", "Queso Costeño"],
    }

    render(
      <RestaurantProvider>
        <AdditionsModal
          product={productWithLegacyAdditions}
          onClose={() => {}}
          onAddToCart={() => {}}
        />
      </RestaurantProvider>
    )

    expect(screen.getByText("Tocineta Ahumada")).toBeDefined()
    expect(screen.getByText("Queso Costeño")).toBeDefined()
  })
})
