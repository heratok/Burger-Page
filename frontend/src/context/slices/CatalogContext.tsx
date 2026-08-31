import React, { createContext, useContext, useCallback, useMemo } from "react"
import type { StorefrontConfig, MenuItem, AdditionItem } from "@/types/restaurant"
import { DEFAULT_STORE_CONFIG } from "@/constants/themePresets"
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
      const tempId = `add-${Date.now()}`
      const newItem: AdditionItem = { ...item, id: tempId }
      let previousAdditions: AdditionItem[] = []

      updateActiveRestaurantRecord((current) => {
        previousAdditions = current.additions
        return {
          ...current,
          additions: [...current.additions, newItem],
        }
      })
      toast.success(`Adicional "${item.name}" creado`)

      // Sync with backend API
      apiClient.createAddition({
        name: item.name,
        price: item.price,
        isAvailable: item.available,
      }).then((created) => {
        updateActiveRestaurantRecord((current) => ({
          ...current,
          additions: current.additions.map((a) => (a.id === tempId ? created : a)),
        }))
      }).catch((err) => {
        if (import.meta.env?.MODE !== 'test') {
          console.warn("Could not persist addition to backend API:", err)
        }
        // Rollback to pre-optimistic snapshot
        updateActiveRestaurantRecord((current) => ({
          ...current,
          additions: previousAdditions,
        }))
        toast.error("Error al guardar adicional en el servidor")
      })
    },
    [updateActiveRestaurantRecord]
  )

  const updateAddition = useCallback(
    (id: string, updates: Partial<AdditionItem>) => {
      let previousAdditions: AdditionItem[] = []

      updateActiveRestaurantRecord((current) => {
        previousAdditions = current.additions
        return {
          ...current,
          additions: current.additions.map((a) =>
            a.id === id ? { ...a, ...updates } : a
          ),
        }
      })
      toast.success("Adicional actualizado")

      // Sync with backend API
      apiClient.updateAddition(id, {
        name: updates.name,
        price: updates.price,
        isAvailable: updates.available,
      }).catch((err) => {
        if (import.meta.env?.MODE !== 'test') {
          console.warn("Could not update addition in backend API:", err)
        }
        // Rollback to pre-optimistic snapshot
        updateActiveRestaurantRecord((current) => ({
          ...current,
          additions: previousAdditions,
        }))
        toast.error("Error al actualizar adicional en el servidor")
      })
    },
    [updateActiveRestaurantRecord]
  )

  const deleteAddition = useCallback(
    (id: string) => {
      let previousAdditions: AdditionItem[] = []

      updateActiveRestaurantRecord((current) => {
        previousAdditions = current.additions
        return {
          ...current,
          additions: current.additions.filter((a) => a.id !== id),
        }
      })
      toast.success("Adicional eliminado")

      // Sync with backend API
      apiClient.deleteAddition(id).catch((err) => {
        if (import.meta.env?.MODE !== 'test') {
          console.warn("Could not delete addition from backend API:", err)
        }
        // Rollback to pre-optimistic snapshot
        updateActiveRestaurantRecord((current) => ({
          ...current,
          additions: previousAdditions,
        }))
        toast.error("Error al eliminar adicional del servidor")
      })
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
          if (import.meta.env?.MODE !== 'test') {
            console.warn("Could not sync categories to backend API:", err)
          }
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
        if (existing.some((c) => c.toLowerCase() === trimmedNew.toLowerCase() && c.toLowerCase() !== oldName.toLowerCase())) {
          toast.warning(`Ya existe una categoría llamada "${trimmedNew}"`)
          return current
        }
        const nextCategories = existing.map((c) => (c === oldName ? trimmedNew : c))
        const nextProducts = current.products.map((p) => (p.category === oldName ? { ...p, category: trimmedNew } : p))
        apiClient.updateCategories(nextCategories, current.slug).catch((err) => {
          if (import.meta.env?.MODE !== 'test') {
            console.warn("Could not sync categories to backend API:", err)
          }
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
          if (import.meta.env?.MODE !== 'test') {
            console.warn("Could not sync categories to backend API:", err)
          }
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
