import React, { createContext, useContext, useCallback, useMemo } from "react"
import type { StorefrontConfig, MenuItem, AdditionItem } from "@/types/restaurant"
import { DEFAULT_STORE_CONFIG } from "@/data/initialData"
import { useTenant } from "./TenantContext"
import { apiClient } from "@/core/api/apiClient"
import { toast } from "sonner"

export interface CatalogContextType {
  storeConfig: StorefrontConfig
  updateStoreConfig: (newConfig: Partial<StorefrontConfig>) => void
  resetStoreConfig: () => void
  categories: string[]
  addCategory: (categoryName: string) => void
  updateCategory: (oldName: string, newName: string) => void
  deleteCategory: (categoryName: string) => void
  products: MenuItem[]
  addProduct: (item: Omit<MenuItem, "id">) => void
  updateProduct: (id: string, updates: Partial<MenuItem>) => void
  deleteProduct: (id: string) => void
  toggleProductStock: (id: string) => void
  additions: AdditionItem[]
  addAddition: (item: Omit<AdditionItem, "id">) => void
  updateAddition: (id: string, updates: Partial<AdditionItem>) => void
  deleteAddition: (id: string) => void
}

const CatalogContext = createContext<CatalogContextType | undefined>(undefined)

export const CatalogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeRestaurant, updateActiveRestaurantRecord } = useTenant()

  const updateStoreConfig = useCallback(
    (newConfig: Partial<StorefrontConfig>) => {
      updateActiveRestaurantRecord((current) => ({
        ...current,
        config: { ...current.config, ...newConfig },
      }))
      toast.success("Diseño y configuración actualizados")
    },
    [updateActiveRestaurantRecord]
  )

  const resetStoreConfig = useCallback(() => {
    updateActiveRestaurantRecord((current) => ({
      ...current,
      config: DEFAULT_STORE_CONFIG,
    }))
    toast.info("Diseño restablecido a los valores por defecto")
  }, [updateActiveRestaurantRecord])

  const addProduct = useCallback(
    (item: Omit<MenuItem, "id">) => {
      const newItem: MenuItem = { ...item, id: `prod-${Date.now()}` }
      updateActiveRestaurantRecord((current) => ({
        ...current,
        products: [newItem, ...current.products],
      }))
      toast.success(`"${item.name}" agregado al menú`)
    },
    [updateActiveRestaurantRecord]
  )

  const updateProduct = useCallback(
    (id: string, updates: Partial<MenuItem>) => {
      updateActiveRestaurantRecord((current) => ({
        ...current,
        products: current.products.map((p) =>
          p.id === id ? { ...p, ...updates } : p
        ),
      }))
      toast.success("Producto actualizado")
    },
    [updateActiveRestaurantRecord]
  )

  const deleteProduct = useCallback(
    (id: string) => {
      updateActiveRestaurantRecord((current) => ({
        ...current,
        products: current.products.filter((p) => p.id !== id),
      }))
      toast.success("Producto eliminado del menú")
    },
    [updateActiveRestaurantRecord]
  )

  const toggleProductStock = useCallback(
    (id: string) => {
      updateActiveRestaurantRecord((current) => {
        let isNowInStock = false
        const nextProducts = current.products.map((p) => {
          if (p.id === id) {
            isNowInStock = !p.inStock
            return { ...p, inStock: isNowInStock }
          }
          return p
        })
        toast.info(`Producto marcado como ${isNowInStock ? "Disponible" : "Agotado"}`)
        return { ...current, products: nextProducts }
      })
    },
    [updateActiveRestaurantRecord]
  )

  const addAddition = useCallback(
    (item: Omit<AdditionItem, "id">) => {
      const newItem: AdditionItem = { ...item, id: `add-${Date.now()}` }
      updateActiveRestaurantRecord((current) => ({
        ...current,
        additions: [...current.additions, newItem],
      }))
      toast.success(`Topping "${item.name}" creado`)
    },
    [updateActiveRestaurantRecord]
  )

  const updateAddition = useCallback(
    (id: string, updates: Partial<AdditionItem>) => {
      updateActiveRestaurantRecord((current) => ({
        ...current,
        additions: current.additions.map((a) =>
          a.id === id ? { ...a, ...updates } : a
        ),
      }))
      toast.success("Topping actualizado")
    },
    [updateActiveRestaurantRecord]
  )

  const deleteAddition = useCallback(
    (id: string) => {
      updateActiveRestaurantRecord((current) => ({
        ...current,
        additions: current.additions.filter((a) => a.id !== id),
      }))
      toast.success("Topping eliminado")
    },
    [updateActiveRestaurantRecord]
  )

  const categories = useMemo(() => {
    const rawList = activeRestaurant.categories && activeRestaurant.categories.length > 0
      ? activeRestaurant.categories
      : Array.from(new Set(activeRestaurant.products.map((p) => p.category).filter(Boolean)))
    
    // Always ensure at least default categories if empty
    return rawList.length > 0 ? rawList : ["Platos Principales"]
  }, [activeRestaurant.categories, activeRestaurant.products])

  const addCategory = useCallback(
    (categoryName: string) => {
      const trimmed = categoryName.trim()
      if (!trimmed) {
        toast.error("El nombre de la categoría no puede estar vacío")
        return
      }
      updateActiveRestaurantRecord((current) => {
        const existing = current.categories && current.categories.length > 0
          ? current.categories
          : Array.from(new Set(current.products.map((p) => p.category).filter(Boolean)))
        if (existing.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
          toast.warning(`La categoría "${trimmed}" ya existe`)
          return current
        }
        const nextCategories = [...existing, trimmed]
        apiClient.updateCategories(nextCategories, current.slug).catch((err) => {
          console.warn("Could not sync categories to backend API:", err)
        })
        toast.success(`Categoría "${trimmed}" creada`)
        return {
          ...current,
          categories: nextCategories,
        }
      })
    },
    [updateActiveRestaurantRecord]
  )

  const updateCategory = useCallback(
    (oldName: string, newName: string) => {
      const trimmedNew = newName.trim()
      if (!trimmedNew) {
        toast.error("El nombre de la categoría no puede estar vacío")
        return
      }
      if (oldName.toLowerCase() === trimmedNew.toLowerCase()) {
        return
      }
      updateActiveRestaurantRecord((current) => {
        const existing = current.categories && current.categories.length > 0
          ? current.categories
          : Array.from(new Set(current.products.map((p) => p.category).filter(Boolean)))
        const nextCategories = existing.map((c) => (c === oldName ? trimmedNew : c))
        const nextProducts = current.products.map((p) => (p.category === oldName ? { ...p, category: trimmedNew } : p))
        apiClient.updateCategories(nextCategories, current.slug).catch((err) => {
          console.warn("Could not sync categories to backend API:", err)
        })
        toast.success(`Categoría renombrada a "${trimmedNew}"`)
        return {
          ...current,
          categories: nextCategories,
          products: nextProducts,
        }
      })
    },
    [updateActiveRestaurantRecord]
  )

  const deleteCategory = useCallback(
    (categoryName: string) => {
      updateActiveRestaurantRecord((current) => {
        const existing = current.categories && current.categories.length > 0
          ? current.categories
          : Array.from(new Set(current.products.map((p) => p.category).filter(Boolean)))
        if (existing.length <= 1) {
          toast.error("El restaurante debe tener al menos una categoría")
          return current
        }
        const nextCategories = existing.filter((c) => c !== categoryName)
        const fallback = nextCategories[0] || "General"
        const nextProducts = current.products.map((p) => (p.category === categoryName ? { ...p, category: fallback } : p))
        apiClient.updateCategories(nextCategories, current.slug).catch((err) => {
          console.warn("Could not sync categories to backend API:", err)
        })
        toast.success(`Categoría "${categoryName}" eliminada`)
        return {
          ...current,
          categories: nextCategories,
          products: nextProducts,
        }
      })
    },
    [updateActiveRestaurantRecord]
  )

  const value: CatalogContextType = {
    storeConfig: activeRestaurant.config,
    updateStoreConfig,
    resetStoreConfig,
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
    products: activeRestaurant.products,
    addProduct,
    updateProduct,
    deleteProduct,
    toggleProductStock,
    additions: activeRestaurant.additions,
    addAddition,
    updateAddition,
    deleteAddition,
  }

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}

export const useCatalog = (): CatalogContextType => {
  const context = useContext(CatalogContext)
  if (!context) {
    throw new Error("useCatalog must be used within a CatalogProvider")
  }
  return context
}
