import React, { createContext, useContext, useCallback, useMemo } from "react"
import type { InventoryItem, Supplier } from "@/types/restaurant"
import { apiClient } from "@/core/api/apiClient"
import { useTenant } from "./TenantContext"
import { useAuth } from "./AuthContext"
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
  const { session } = useAuth()

  // Hydrate inventory from database
  React.useEffect(() => {
    const targetRestId = activeRestaurant?.id
    if (!targetRestId || !apiClient.hasToken()) return
    let isCancelled = false

    apiClient
      .fetchInventory(targetRestId)
      .then((backendInventory) => {
        if (isCancelled) return
        if (Array.isArray(backendInventory)) {
          updateActiveRestaurantRecord((current) => {
            if (current.id !== targetRestId) return current
            return {
              ...current,
              inventory: backendInventory,
            }
          })
        }
      })
      .catch((err) => {
        if (import.meta.env?.MODE !== 'test') {
          console.warn("Could not fetch inventory from backend API:", err)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [activeRestaurant?.id, session, updateActiveRestaurantRecord])

  const inventory: InventoryItem[] = useMemo(() => {
    return activeRestaurant.inventory || []
  }, [activeRestaurant.inventory])

  const suppliers: Supplier[] = useMemo(() => {
    return activeRestaurant.suppliers || []
  }, [activeRestaurant.suppliers])

  const addInventoryItem = useCallback(
    (item: Omit<InventoryItem, "id">) => {
      const tempId = `inv-${Date.now()}`
      const newItem: InventoryItem = {
        ...item,
        id: tempId,
        lastRestockedAt: new Date().toISOString(),
      }
      let previousInventory: InventoryItem[] = []
      updateActiveRestaurantRecord((current) => {
        previousInventory = current.inventory || []
        return {
          ...current,
          inventory: [newItem, ...previousInventory],
        }
      })
      toast.success(`Insumo "${item.name}" agregado al inventario`)

      apiClient
        .createInventoryItem({
          restaurantId: activeRestaurant.id,
          name: item.name,
          category: item.category,
          quantity: item.currentStock,
          unit: item.unit,
          minStockAlert: item.minStockAlert,
          alertThreshold: item.minStockAlert,
          costPerUnit: item.costPerUnit,
        })
        .then((created) => {
          if (created && created.id) {
            updateActiveRestaurantRecord((current) => ({
              ...current,
              inventory: (current.inventory || []).map((i) =>
                i.id === tempId ? created : i
              ),
            }))
          }
        })
        .catch((err) => {
          if (import.meta.env?.MODE !== 'test') {
            console.warn("Could not persist inventory item to backend API:", err)
          }
          updateActiveRestaurantRecord((current) => ({
            ...current,
            inventory: previousInventory,
          }))
          toast.error("Error al guardar insumo en el servidor")
        })
    },
    [activeRestaurant.id, updateActiveRestaurantRecord]
  )

  const updateInventoryItem = useCallback(
    (id: string, updates: Partial<InventoryItem>) => {
      if (updates.currentStock !== undefined) {
        const currentItem = (activeRestaurant.inventory || []).find((item) => item.id === id)
        if (currentItem) {
          const delta = updates.currentStock - currentItem.currentStock
          if (delta !== 0) {
            apiClient.updateInventoryStock(id, delta, activeRestaurant.id).catch((error) => {
              if (import.meta.env?.MODE !== 'test') {
                console.warn(`Could not sync stock update for inventory item ${id} to backend:`, error)
              }
            })
          }
        }
      }

      apiClient.updateInventoryItem(id, updates, activeRestaurant.id).catch((error) => {
        if (import.meta.env?.MODE !== 'test') {
          console.warn(`Could not sync inventory item ${id} updates to backend:`, error)
        }
      })

      updateActiveRestaurantRecord((current) => ({
        ...current,
        inventory: (current.inventory || []).map((item) =>
          item.id === id ? { ...item, ...updates } : item
        ),
      }))
      toast.success("Insumo actualizado")
    },
    [activeRestaurant.id, activeRestaurant.inventory, updateActiveRestaurantRecord]
  )

  const deleteInventoryItem = useCallback(
    (id: string) => {
      updateActiveRestaurantRecord((current) => ({
        ...current,
        inventory: (current.inventory || []).filter((item) => item.id !== id),
      }))
      toast.success("Insumo eliminado del inventario")

      apiClient.deleteInventoryItem(id, activeRestaurant.id).catch((error) => {
        if (import.meta.env?.MODE !== 'test') {
          console.warn(`Could not delete inventory item ${id} from backend:`, error)
        }
      })
    },
    [activeRestaurant.id, updateActiveRestaurantRecord]
  )

  const adjustStock = useCallback(
    (id: string, deltaQuantity: number) => {
      apiClient.updateInventoryStock(id, deltaQuantity, activeRestaurant.id).catch((error) => {
        if (import.meta.env?.MODE !== 'test') {
          console.warn(`Could not sync adjust stock for ${id} to backend:`, error)
        }
      })

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
    },
    [activeRestaurant.id, updateActiveRestaurantRecord]
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
