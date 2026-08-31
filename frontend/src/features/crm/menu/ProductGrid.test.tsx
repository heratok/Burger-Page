import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { ProductGrid } from "./ProductGrid"
import type { MenuItem } from "@/types/restaurant"

const mockProducts: MenuItem[] = [
  {
    id: "p-1",
    name: "Burger Deluxe",
    price: 32000,
    category: "Hamburguesas",
    src: "https://example.com/burger.jpg",
    description: "Deliciosa hamburguesa con doble queso",
    inStock: true,
    isPopular: true,
    isNew: true,
  },
  {
    id: "p-2",
    name: "Papas Fritas",
    price: 12000,
    category: "Acompañamientos",
    src: "https://example.com/fries.jpg",
    description: "Papas crujientes",
    inStock: false,
    isPopular: false,
    isNew: false,
  },
]

describe("ProductGrid", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders product cards with names, prices, tags, and stock state", () => {
    render(
      <ProductGrid
        products={mockProducts}
        onToggleStock={vi.fn()}
        onEditProduct={vi.fn()}
        onDeleteProduct={vi.fn()}
      />
    )

    expect(screen.getByText("Burger Deluxe")).toBeDefined()
    expect(screen.getByText("Papas Fritas")).toBeDefined()
    expect(screen.getByText("Popular")).toBeDefined()
    expect(screen.getByText("Nuevo")).toBeDefined()
    expect(screen.getByText("Agotado Temporalmente")).toBeDefined()
  })

  it("handles edit, delete, and stock toggle interactions", () => {
    const onToggleStock = vi.fn()
    const onEditProduct = vi.fn()
    const onDeleteProduct = vi.fn()

    render(
      <ProductGrid
        products={mockProducts}
        onToggleStock={onToggleStock}
        onEditProduct={onEditProduct}
        onDeleteProduct={onDeleteProduct}
      />
    )

    const editButtons = screen.getAllByTitle("Editar plato")
    fireEvent.click(editButtons[0])
    expect(onEditProduct).toHaveBeenCalledWith(mockProducts[0])

    const deleteButtons = screen.getAllByTitle("Eliminar plato")
    fireEvent.click(deleteButtons[0])
    expect(onDeleteProduct).toHaveBeenCalledWith(mockProducts[0])

    const stockSwitches = screen.getAllByRole("switch")
    fireEvent.click(stockSwitches[0])
    expect(onToggleStock).toHaveBeenCalledWith(mockProducts[0].id)
  })
})
