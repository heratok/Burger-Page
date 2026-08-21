import { describe, it, expect } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useMenuFilter } from "./useMenuFilter"
import type { MenuItem } from "@/types/restaurant"

const mockProducts: MenuItem[] = [
  {
    id: "1",
    name: "Cheeseburger",
    price: 25000,
    category: "Burgers",
    src: "",
    description: "Beef and cheese",
    inStock: true,
  },
  {
    id: "2",
    name: "Veggie Burger",
    price: 22000,
    category: "Veggie",
    src: "",
    description: "Lentil patty",
    inStock: true,
  },
  {
    id: "3",
    name: "Pepperoni Pizza",
    price: 35000,
    category: "Pizzas",
    src: "",
    description: "Crispy crust and cheese",
    inStock: false,
  },
]

describe("useMenuFilter", () => {
  it("extracts unique categories from products", () => {
    const { result } = renderHook(() => useMenuFilter(mockProducts))
    expect(result.current.categories).toEqual(["Burgers", "Veggie", "Pizzas"])
    expect(result.current.filteredProducts).toHaveLength(3)
  })

  it("filters products by search term matching name or description", () => {
    const { result } = renderHook(() => useMenuFilter(mockProducts))

    act(() => {
      result.current.setSearchTerm("lentil")
    })

    expect(result.current.filteredProducts).toHaveLength(1)
    expect(result.current.filteredProducts[0].name).toBe("Veggie Burger")
  })

  it("filters products by category", () => {
    const { result } = renderHook(() => useMenuFilter(mockProducts))

    act(() => {
      result.current.setSelectedCategory("Pizzas")
    })

    expect(result.current.filteredProducts).toHaveLength(1)
    expect(result.current.filteredProducts[0].name).toBe("Pepperoni Pizza")
  })

  it("toggles viewMode between grid and table", () => {
    const { result } = renderHook(() => useMenuFilter(mockProducts))
    expect(result.current.viewMode).toBe("grid")

    act(() => {
      result.current.setViewMode("table")
    })

    expect(result.current.viewMode).toBe("table")
  })
})
