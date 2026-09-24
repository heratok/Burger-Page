import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { ProductTable } from "./ProductTable"
import type { MenuItem } from "@/types/restaurant"

const mockProducts: MenuItem[] = [
  {
    id: "p-1",
    name: "Burger Classic",
    price: 25000,
    category: "Hamburguesas",
    src: "https://example.com/classic.jpg",
    description: "Carne artesanal y queso",
    inStock: true,
    isPopular: true,
    isNew: false,
  },
]

describe("ProductTable", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders product table rows with details and actions", () => {
    const onToggleStock = vi.fn()
    const onEditProduct = vi.fn()
    const onDeleteProduct = vi.fn()

    render(
      <ProductTable
        products={mockProducts}
        onToggleStock={onToggleStock}
        onEditProduct={onEditProduct}
        onDeleteProduct={onDeleteProduct}
      />
    )

    expect(screen.getByText("Burger Classic")).toBeDefined()
    expect(screen.getByText("Hamburguesas")).toBeDefined()
    expect(screen.getByText("Popular")).toBeDefined()

    const switchBtn = screen.getByRole("switch")
    fireEvent.click(switchBtn)
    expect(onToggleStock).toHaveBeenCalledWith("p-1")
  })

  it("wraps the table in an overflow-x-auto container so touch users can pan wide tables", () => {
    const { container } = render(
      <ProductTable
        products={mockProducts}
        onToggleStock={vi.fn()}
        onEditProduct={vi.fn()}
        onDeleteProduct={vi.fn()}
      />
    )

    // The other seven admin tables use this same scroll wrapper. Without it the
    // table is clipped by the card's overflow-hidden and cannot be panned on a
    // phone (regression: 2025 menu table wasn't scrollable on mobile).
    const scrollWrapper = container.querySelector("div.overflow-x-auto")
    expect(scrollWrapper).not.toBeNull()
    expect(scrollWrapper?.querySelector("table")).not.toBeNull()
  })
})
