import React, { createContext, useContext, useCallback, useMemo, useState } from "react"
import type { InventoryItem, Supplier } from "@/types/restaurant"
import { apiClient, isNotFoundError } from "@/core/api/apiClient"
import { useTenant } from "./TenantContext"
import { useAuth } from "./AuthContext"
import { toast } from "sonner"
import { nextTempId } from "@/lib/ids"

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
  isLoadingInventory: boolean
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined)

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeRestaurant, updateActiveRestaurantRecord } = useTenant()
  const { session } = useAuth()

  // A1/A2: the inventory fetch keys on the session-aware effective tenant so a
  // restaurant admin's first render never pulls another tenant's stock.
  const effectiveId =
    session.role === "restaurant" && session.restaurantId
      ? session.restaurantId
      : activeRestaurant?.id

  const [isLoadingInventory, setIsLoadingInventory] = useState<boolean>(() => {
    return Boolean(
      apiClient.hasToken() &&
        effectiveId &&
        (!activeRestaurant.inventory || activeRestaurant.inventory.length === 0)
    )
  })

  // Hydrate inventory from database
  React.useEffect(() => {
    const targetRestId = effectiveId
    if (!targetRestId || !apiClient.hasToken()) {
      setIsLoadingInventory(false)
      return
    }
    let isCancelled = false
    setIsLoadingInventory(true)

    Promise.all([
      apiClient.fetchInventory(targetRestId).catch((err) => {
        if (import.meta.env?.MODE !== 'test') {
          console.warn("Could not fetch inventory from backend API:", err)
        }
        return null
      }),
      apiClient.fetchSuppliers(targetRestId).catch((err) => {
        if (import.meta.env?.MODE !== 'test') {
          console.warn("Could not fetch suppliers from backend API:", err)
        }
        return null
      }),
    ])
      .then(([backendInventory, backendSuppliers]) => {
        if (isCancelled) return
        updateActiveRestaurantRecord((current) => {
          if (current.id !== targetRestId) return current
          return {
            ...current,
            ...(Array.isArray(backendInventory) ? { inventory: backendInventory } : {}),
            ...(Array.isArray(backendSuppliers) ? { suppliers: backendSuppliers } : {}),
          }
        })
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingInventory(false)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [effectiveId, session, updateActiveRestaurantRecord])

  const inventory: InventoryItem[] = useMemo(() => {
    return activeRestaurant.inventory || []
  }, [activeRestaurant.inventory])

  const suppliers: Supplier[] = useMemo(() => {
    return activeRestaurant.suppliers || []
  }, [activeRestaurant.suppliers])

  const addInventoryItem = useCallback(
    (item: Omit<InventoryItem, "id">) => {
      const tempId = nextTempId("inv")
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
      const previousInventory = activeRestaurant?.inventory || []

      updateActiveRestaurantRecord((current) => ({
        ...current,
        inventory: (current.inventory || []).map((item) =>
          item.id === id ? { ...item, ...updates } : item
        ),
      }))
      toast.success("Insumo actualizado")

      const payload: Record<string, unknown> = { ...updates }
      if (updates.currentStock !== undefined) {
        payload.quantity = updates.currentStock
        delete payload.currentStock
      }

      apiClient
        .updateInventoryItem(id, payload as any, activeRestaurant.id)
        .catch((error) => {
          if (import.meta.env?.MODE !== 'test') {
            console.warn(`Could not sync inventory item ${id} updates to backend:`, error)
          }
          updateActiveRestaurantRecord((current) => ({
            ...current,
            inventory: previousInventory,
          }))
          toast.error("Error al actualizar insumo en el servidor")
        })
    },
    [activeRestaurant.id, activeRestaurant.inventory, updateActiveRestaurantRecord]
  )

  const deleteInventoryItem = useCallback(
    (id: string) => {
      const previousInventory = activeRestaurant?.inventory || []

      updateActiveRestaurantRecord((current) => ({
        ...current,
        inventory: (current.inventory || []).filter((item) => item.id !== id),
      }))
      toast.success("Insumo eliminado del inventario")

      apiClient
        .deleteInventoryItem(id, activeRestaurant.id)
        .catch((error) => {
          if (isNotFoundError(error)) {
            // Resource already absent on server: preserve client deletion without rollback
            return
          }
          if (import.meta.env?.MODE !== 'test') {
            console.warn(`Could not delete inventory item ${id} from backend:`, error)
          }
          updateActiveRestaurantRecord((current) => ({
            ...current,
            inventory: previousInventory,
          }))
          toast.error("Error al eliminar insumo del servidor")
        })
    },
    [activeRestaurant.id, activeRestaurant.inventory, updateActiveRestaurantRecord]
  )

  const adjustStock = useCallback(
    (id: string, deltaQuantity: number) => {
      const previousInventory = activeRestaurant?.inventory || []

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

      apiClient
        .updateInventoryStock(id, deltaQuantity, activeRestaurant.id)
        .catch((error) => {
          if (import.meta.env?.MODE !== 'test') {
            console.warn(`Could not sync adjust stock for ${id} to backend:`, error)
          }
          updateActiveRestaurantRecord((current) => ({
            ...current,
            inventory: previousInventory,
          }))
          toast.error("Error al sincronizar el inventario con el servidor")
        })
    },
    [activeRestaurant.id, activeRestaurant.inventory, updateActiveRestaurantRecord]
  )

  const addSupplier = useCallback(
    (supplier: Omit<Supplier, "id">) => {
      const tempId = nextTempId("sup")
      const newSup: Supplier = {
        ...supplier,
        id: tempId,
      }
      updateActiveRestaurantRecord((current) => ({
        ...current,
        suppliers: [newSup, ...(current.suppliers || [])],
      }))
      toast.success(`Proveedor "${supplier.name}" registrado`)

      const targetRestId = activeRestaurant.id
      apiClient
        .createSupplier(supplier, targetRestId)
        .then((created) => {
          if (created?.id) {
            updateActiveRestaurantRecord((current) => ({
              ...current,
              suppliers: (current.suppliers || []).map((s) =>
                s.id === tempId ? created : s
              ),
            }))
          }
        })
        .catch((err) => {
          if (import.meta.env?.MODE !== 'test') {
            console.warn("Could not sync supplier creation to backend API:", err)
          }
          updateActiveRestaurantRecord((current) => ({
            ...current,
            suppliers: (current.suppliers || []).filter((s) => s.id !== tempId),
          }))
          toast.error("Error al registrar proveedor en el servidor")
        })
    },
    [activeRestaurant.id, updateActiveRestaurantRecord]
  )

  const updateSupplier = useCallback(
    (id: string, updates: Partial<Supplier>) => {
      let previousSuppliers: Supplier[] = []
      updateActiveRestaurantRecord((current) => {
        previousSuppliers = current.suppliers || []
        return {
          ...current,
          suppliers: (current.suppliers || []).map((sup) =>
            sup.id === id ? { ...sup, ...updates } : sup
          ),
        }
      })
      toast.success("Proveedor actualizado")

      const targetRestId = activeRestaurant.id
      apiClient
        .updateSupplier(id, updates, targetRestId)
        .catch((err) => {
          if (import.meta.env?.MODE !== 'test') {
            console.warn("Could not sync supplier update to backend API:", err)
          }
          updateActiveRestaurantRecord((current) => ({
            ...current,
            suppliers: previousSuppliers,
          }))
          toast.error("Error al actualizar proveedor en el servidor")
        })
    },
    [activeRestaurant.id, updateActiveRestaurantRecord]
  )

  const deleteSupplier = useCallback(
    (id: string) => {
      let previousSuppliers: Supplier[] = []
      updateActiveRestaurantRecord((current) => {
        previousSuppliers = current.suppliers || []
        return {
          ...current,
          suppliers: (current.suppliers || []).filter((sup) => sup.id !== id),
        }
      })
      toast.success("Proveedor eliminado")

      const targetRestId = activeRestaurant.id
      apiClient
        .deleteSupplier(id, targetRestId)
        .catch((err) => {
          if (import.meta.env?.MODE !== 'test') {
            console.warn("Could not sync supplier deletion to backend API:", err)
          }
          updateActiveRestaurantRecord((current) => ({
            ...current,
            suppliers: previousSuppliers,
          }))
          toast.error("Error al eliminar proveedor en el servidor")
        })
    },
    [activeRestaurant.id, updateActiveRestaurantRecord]
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
    isLoadingInventory,
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
