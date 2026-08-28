import { useState, useMemo } from "react"
import type { MenuItem } from "@/types/restaurant"

export function useMenuFilter(products: MenuItem[], availableCategories?: string[]) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL")
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid")

  const categories = useMemo(() => {
    const set = new Set<string>(availableCategories || [])
    products.forEach((p) => {
      if (p.category) set.add(p.category)
    })
    return Array.from(set)
  }, [products, availableCategories])

  const filteredProducts = useMemo(() => {
    const query = searchTerm.toLowerCase().trim()
    return products.filter((p) => {
      const matchSearch =
        !query ||
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query)
      const matchCat =
        selectedCategory === "ALL" || p.category === selectedCategory
      return matchSearch && matchCat
    })
  }, [products, searchTerm, selectedCategory])

  return {
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    viewMode,
    setViewMode,
    categories,
    filteredProducts,
  }
}
