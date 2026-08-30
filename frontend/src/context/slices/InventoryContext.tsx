import React, { createContext, useContext, useCallback, useMemo } from "react"
import type { InventoryItem, Supplier } from "@/types/restaurant"
import { apiClient } from "@/core/api/apiClient"
import { useTenant } from "./TenantContext"
import { toast } from "sonner"

export interface InventoryContextType {
  inventory: InventoryItem[]
  suppliers: Supplier[]
  addInventoryItem: (item: Omit<InventoryItem, "id">) => void
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => void
  deleteInventoryItem: (id: string) => void
  adjustStock: (id: string, deltaQuantity: number) => void
  addSupplier: (supplier: Omit<Supplier, "id">) => void
  updateSupplier: (id: string, updates: Partial<Supplier>) => void
  deleteSupplier: (id: string) => void
  lowStockCount: number
  totalInventoryValue: number
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined)

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeRestaurant, updateActiveRestaurantRecord } = useTenant()

  const inventory: InventoryItem[] = useMemo(() => {
    return activeRestaurant.inventory || []
  }, [activeRestaurant.inventory])

  const suppliers: Supplier[] = useMemo(() => {
    return activeRestaurant.suppliers || []
  }, [activeRestaurant.suppliers])

  const addInventoryItem = useCallback(
    (item: Omit<InventoryItem, "id">) => {
      const newItem: InventoryItem = {
        ...item,
        id: `inv-${Date.now()}`,
        lastRestockedAt: new Date().toISOString(),
      }
      updateActiveRestaurantRecord((current) => ({
        ...current,
        inventory: [newItem, ...(current.inventory || [])],
      }))
      toast.success(`Insumo "${item.name}" agregado al inventario`)
    },
    [updateActiveRestaurantRecord]
  )

  const updateInventoryItem = useCallback(
    (id: string, updates: Partial<InventoryItem>) => {
      if (updates.currentStock !== undefined) {
        const currentItem = (activeRestaurant.inventory || []).find((item) => item.id === id)
        if (currentItem) {
          const delta = updates.currentStock - currentItem.currentStock
          if (delta !== 0) {
            apiClient.updateInventoryStock(id, delta).catch((error) => {
              if (import.meta.env?.MODE !== 'test') {
                console.warn(`Could not sync stock update for inventory item ${id} to backend:`, error)
              }
            })
          }
        }
      }

      updateActiveRestaurantRecord((current) => ({
        ...current,
        inventory: (current.inventory || []).map((item) =>
          item.id === id ? { ...item, ...updates } : item
        ),
      }))
      toast.success("Insumo actualizado")
    },
    [activeRestaurant.inventory, updateActiveRestaurantRecord]
  )

  const deleteInventoryItem = useCallback(
    (id: string) => {
      updateActiveRestaurantRecord((current) => ({
        ...current,
        inventory: (current.inventory || []).filter((item) => item.id !== id),
      }))
      toast.success("Insumo eliminado del inventario")
    },
    [updateActiveRestaurantRecord]
  )

  const adjustStock = useCallback(
    (id: string, deltaQuantity: number) => {
      updateActiveRestaurantRecord((current) => {
        let updatedName = ""
        let newStock = 0
        const updatedList = (current.inventory || []).map((item) => {
          if (item.id === id) {
            updatedName = item.name
            newStock = Math.max(0, Number((item.currentStock + deltaQuantity).toFixed(2)))
            return {
              ...item,
              currentStock: newStock,
              lastRestockedAt: deltaQuantity > 0 ? new Date().toISOString() : item.lastRestockedAt,
            }
          }
          return item
        })
        if (deltaQuantity > 0) {
          toast.success(`+${deltaQuantity} añadido a "${updatedName}" (Total: ${newStock})`)
        } else {
          toast.info(`${deltaQuantity} descontado de "${updatedName}" (Total: ${newStock})`)
        }
        return {
          ...current,
          inventory: updatedList,
        }
      })

      // Backend API Integration with graceful offline fallback
      apiClient.updateInventoryStock(id, deltaQuantity).catch((error) => {
        if (import.meta.env?.MODE !== 'test') {
          console.warn(`Could not sync stock adjustment for inventory item ${id} to backend API:`, error)
        }
      })
    },
    [updateActiveRestaurantRecord]
  )

  const addSupplier = useCallback(
    (supplier: Omit<Supplier, "id">) => {
      const newSup: Supplier = {
        ...supplier,
        id: `sup-${Date.now()}`,
      }
      updateActiveRestaurantRecord((current) => ({
        ...current,
        suppliers: [newSup, ...(current.suppliers || [])],
      }))
      toast.success(`Proveedor "${supplier.name}" registrado`)
    },
    [updateActiveRestaurantRecord]
  )

  const updateSupplier = useCallback(
    (id: string, updates: Partial<Supplier>) => {
      updateActiveRestaurantRecord((current) => ({
        ...current,
        suppliers: (current.suppliers || []).map((sup) =>
          sup.id === id ? { ...sup, ...updates } : sup
        ),
      }))
      toast.success("Proveedor actualizado")
    },
    [updateActiveRestaurantRecord]
  )

  const deleteSupplier = useCallback(
    (id: string) => {
      updateActiveRestaurantRecord((current) => ({
        ...current,
        suppliers: (current.suppliers || []).filter((sup) => sup.id !== id),
      }))
      toast.success("Proveedor eliminado")
    },
    [updateActiveRestaurantRecord]
  )

  const lowStockCount = useMemo(() => {
    return inventory.filter((item) => item.currentStock <= item.minStockAlert).length
  }, [inventory])

  const totalInventoryValue = useMemo(() => {
    return inventory.reduce((sum, item) => sum + item.currentStock * item.costPerUnit, 0)
  }, [inventory])

  const value: InventoryContextType = {
    inventory,
    suppliers,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    adjustStock,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    lowStockCount,
    totalInventoryValue,
  }

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
}

export const useInventory = (): InventoryContextType => {
  const context = useContext(InventoryContext)
  if (!context) {
    throw new Error("useInventory must be used within an InventoryProvider")
  }
  return context
}
