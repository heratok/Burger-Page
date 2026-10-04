import React, { createContext, useContext, useCallback, useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { InventoryItem, Supplier } from "@/types/restaurant"
import { apiClient, isNotFoundError } from "@/core/api/apiClient"
import { useTenant } from "./TenantContext"
import { useAuth } from "./AuthContext"
import { toast } from "sonner"
import { nextTempId } from "@/lib/ids"
import { keyPrefixes } from "@/core/query/keys"
import { inventoryQueryOptions, suppliersQueryOptions } from "@/core/query/options"

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

/**
 * A 409 on an inventory write means the name is already taken. The server
 * detail is English and stable, so the UI maps by status to Spanish instead of
 * surfacing the raw text; anything else stays generic.
 */
function conflictMessage(err: unknown, itemName: string | undefined, fallback: string): string {
  const e = err as { status?: number } | null
  return e?.status === 409 && itemName ? `Ya existe un insumo llamado '${itemName}'.` : fallback
}

const warn = (message: string, err: unknown) => {
  if (import.meta.env?.MODE !== 'test') {
    console.warn(message, err)
  }
}

const round = (n: number) => Number(n.toFixed(2))

// Shared mutation key so settled writes can tell whether others are in flight.
const MUTATION_KEY = ["inventory-slice"] as const

// Every write carries its already-dispatched request: the HTTP call fires at the
// user action (as before) and the mutation tracks it for settle/rollback.
interface WithRequest<T> {
  request: Promise<T>
}
type Inv = Awaited<ReturnType<typeof apiClient.createInventoryItem>>
type Sup = Awaited<ReturnType<typeof apiClient.createSupplier>>

interface CreateItemVars extends WithRequest<Inv> {
  tempId: string
  name: string
}
interface UpdateItemVars extends WithRequest<unknown> {
  id: string
  previousFields: Record<string, unknown>
  fallbackName: string | undefined
}
interface DeleteItemVars extends WithRequest<unknown> {
  id: string
  previousInventory: InventoryItem[]
}
interface AdjustStockVars extends WithRequest<unknown> {
  id: string
  appliedDelta: number
}
interface CreateSupplierVars extends WithRequest<Sup> {
  tempId: string
}
interface UpdateSupplierVars extends WithRequest<unknown> {
  snapshot: { previous: Supplier[] }
}
interface DeleteSupplierVars extends WithRequest<unknown> {
  snapshot: { previous: Supplier[] }
}

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeRestaurant, updateActiveRestaurantRecord } = useTenant()
  const { session } = useAuth()
  const queryClient = useQueryClient()

  // A1/A2: the inventory fetch keys on the session-aware effective tenant so a
  // restaurant admin's first render never pulls another tenant's stock.
  const effectiveId =
    session.role === "restaurant" && session.restaurantId
      ? session.restaurantId
      : activeRestaurant?.id

  // No tenant or no token, no fetch. The role is part of the key so a cache
  // entry can never be served across roles.
  const enabled = Boolean(effectiveId && apiClient.hasToken())

  const inventoryQuery = useQuery({ ...inventoryQueryOptions(effectiveId, session.role), enabled })
  const suppliersQuery = useQuery({ ...suppliersQueryOptions(effectiveId, session.role), enabled })

  // Initial hydration only (isLoading = no data yet and fetching); background
  // refetches after writes must not flash the loading state.
  const isLoadingInventory = enabled && (inventoryQuery.isLoading || suppliersQuery.isLoading)

  // The tenant record stays the offline-first store other slices persist and
  // read; query results hydrate it. A failed fetch leaves local data untouched.
  const backendInventory = inventoryQuery.data
  const backendSuppliers = suppliersQuery.data
  React.useEffect(() => {
    if (!effectiveId) return
    const hasInventory = Array.isArray(backendInventory)
    const hasSuppliers = Array.isArray(backendSuppliers)
    if (!hasInventory && !hasSuppliers) return
    updateActiveRestaurantRecord((current) => {
      if (current.id !== effectiveId) return current
      return {
        ...current,
        ...(hasInventory ? { inventory: backendInventory } : {}),
        ...(hasSuppliers ? { suppliers: backendSuppliers } : {}),
      }
    })
  }, [effectiveId, backendInventory, backendSuppliers, updateActiveRestaurantRecord])

  // After a write settles, pull the authoritative server state. While other
  // writes are still in flight the refetch is skipped (the settling mutation
  // counts itself): the last one to settle refetches, so a stale response never
  // overwrites a pending optimistic edit.
  const revalidate = useCallback(
    (key: "inventory" | "suppliers") => {
      if (queryClient.isMutating({ mutationKey: MUTATION_KEY }) > 1) return
      void queryClient.invalidateQueries({ queryKey: keyPrefixes[key](effectiveId) })
    },
    [queryClient, effectiveId]
  )

  const inventory: InventoryItem[] = useMemo(() => {
    return activeRestaurant.inventory || []
  }, [activeRestaurant.inventory])

  const suppliers: Supplier[] = useMemo(() => {
    return activeRestaurant.suppliers || []
  }, [activeRestaurant.suppliers])

  const { mutate: createItem } = useMutation({
    mutationKey: MUTATION_KEY,
    mutationFn: (vars: CreateItemVars) => vars.request,
    onSuccess: (created, { tempId }) => {
      if (created && created.id) {
        updateActiveRestaurantRecord((current) => ({
          ...current,
          inventory: (current.inventory || []).map((i) => (i.id === tempId ? created : i)),
        }))
      }
    },
    onError: (err, { tempId, name }) => {
      warn("Could not persist inventory item to backend API:", err)
      // Remove only the optimistic item; other concurrent changes stay.
      updateActiveRestaurantRecord((current) => ({
        ...current,
        inventory: (current.inventory || []).filter((i) => i.id !== tempId),
      }))
      toast.error(conflictMessage(err, name, "Error al guardar insumo en el servidor"))
    },
    onSettled: () => revalidate("inventory"),
  })

  const { mutate: updateItem } = useMutation({
    mutationKey: MUTATION_KEY,
    mutationFn: (vars: UpdateItemVars) => vars.request,
    onError: (error, { id, previousFields, fallbackName }) => {
      warn(`Could not sync inventory item ${id} updates to backend:`, error)
      updateActiveRestaurantRecord((current) => ({
        ...current,
        inventory: (current.inventory || []).map((item) =>
          item.id === id ? { ...item, ...previousFields } : item
        ),
      }))
      toast.error(conflictMessage(error, fallbackName, "Error al actualizar insumo en el servidor"))
    },
    onSettled: () => revalidate("inventory"),
  })

  const { mutate: deleteItem } = useMutation({
    mutationKey: MUTATION_KEY,
    mutationFn: (vars: DeleteItemVars) => vars.request,
    onError: (error, { id, previousInventory }) => {
      if (isNotFoundError(error)) {
        // Resource already absent on server: preserve client deletion without rollback
        return
      }
      warn(`Could not delete inventory item ${id} from backend:`, error)
      updateActiveRestaurantRecord((current) => ({
        ...current,
        inventory: previousInventory,
      }))
      toast.error("Error al eliminar insumo del servidor")
    },
    onSettled: () => revalidate("inventory"),
  })

  const { mutate: adjustItemStock } = useMutation({
    mutationKey: MUTATION_KEY,
    mutationFn: (vars: AdjustStockVars) => vars.request,
    onError: (error, { id, appliedDelta }) => {
      warn(`Could not sync adjust stock for ${id} to backend:`, error)
      // Undo only this adjust, relative to the CURRENT state, so other
      // accepted adjusts and edits are preserved.
      updateActiveRestaurantRecord((current) => ({
        ...current,
        inventory: (current.inventory || []).map((item) =>
          item.id === id
            ? { ...item, currentStock: Math.max(0, round(item.currentStock - appliedDelta)) }
            : item
        ),
      }))
      toast.error("Error al sincronizar el inventario con el servidor")
    },
    onSettled: () => revalidate("inventory"),
  })

  const { mutate: createSupplierRequest } = useMutation({
    mutationKey: MUTATION_KEY,
    mutationFn: (vars: CreateSupplierVars) => vars.request,
    onSuccess: (created, { tempId }) => {
      if (created?.id) {
        updateActiveRestaurantRecord((current) => ({
          ...current,
          suppliers: (current.suppliers || []).map((s) => (s.id === tempId ? created : s)),
        }))
      }
    },
    onError: (err, { tempId }) => {
      warn("Could not sync supplier creation to backend API:", err)
      updateActiveRestaurantRecord((current) => ({
        ...current,
        suppliers: (current.suppliers || []).filter((s) => s.id !== tempId),
      }))
      toast.error("Error al registrar proveedor en el servidor")
    },
    onSettled: () => revalidate("suppliers"),
  })

  const { mutate: updateSupplierRequest } = useMutation({
    mutationKey: MUTATION_KEY,
    mutationFn: (vars: UpdateSupplierVars) => vars.request,
    onError: (err, { snapshot }) => {
      warn("Could not sync supplier update to backend API:", err)
      updateActiveRestaurantRecord((current) => ({
        ...current,
        suppliers: snapshot.previous,
      }))
      toast.error("Error al actualizar proveedor en el servidor")
    },
    onSettled: () => revalidate("suppliers"),
  })

  const { mutate: deleteSupplierRequest } = useMutation({
    mutationKey: MUTATION_KEY,
    mutationFn: (vars: DeleteSupplierVars) => vars.request,
    onError: (err, { snapshot }) => {
      warn("Could not sync supplier deletion to backend API:", err)
      updateActiveRestaurantRecord((current) => ({
        ...current,
        suppliers: snapshot.previous,
      }))
      toast.error("Error al eliminar proveedor en el servidor")
    },
    onSettled: () => revalidate("suppliers"),
  })

  // Optimistic edits are applied synchronously to the tenant record (the
  // mutation lifecycle itself is async); each mutation owns persist/rollback.
  const addInventoryItem = useCallback(
    (item: Omit<InventoryItem, "id">) => {
      const tempId = nextTempId("inv")
      const newItem: InventoryItem = {
        ...item,
        id: tempId,
        lastRestockedAt: new Date().toISOString(),
      }
      updateActiveRestaurantRecord((current) => ({
        ...current,
        inventory: [newItem, ...(current.inventory || [])],
      }))
      toast.success(`Insumo "${item.name}" agregado al inventario`)

      createItem({
        tempId,
        name: item.name,
        request: apiClient.createInventoryItem({
          restaurantId: activeRestaurant.id,
          name: item.name,
          category: item.category,
          quantity: item.currentStock,
          unit: item.unit,
          minStockAlert: item.minStockAlert,
          alertThreshold: item.minStockAlert,
          costPerUnit: item.costPerUnit,
        }),
      })
    },
    [activeRestaurant.id, updateActiveRestaurantRecord, createItem]
  )

  const updateInventoryItem = useCallback(
    (id: string, updates: Partial<InventoryItem>) => {
      // Remember only this item's previous values for the touched fields.
      const target = (activeRestaurant?.inventory || []).find((i) => i.id === id)
      const previousFields: Record<string, unknown> = {}
      if (target) {
        for (const key of Object.keys(updates) as (keyof InventoryItem)[]) {
          previousFields[key] = target[key]
        }
      }

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

      updateItem({
        id,
        previousFields,
        fallbackName: updates.name ?? target?.name,
        request: apiClient.updateInventoryItem(id, payload as any, activeRestaurant.id),
      })
    },
    [activeRestaurant.id, activeRestaurant.inventory, updateActiveRestaurantRecord, updateItem]
  )

  const deleteInventoryItem = useCallback(
    (id: string) => {
      const previousInventory = activeRestaurant?.inventory || []

      updateActiveRestaurantRecord((current) => ({
        ...current,
        inventory: (current.inventory || []).filter((item) => item.id !== id),
      }))
      toast.success("Insumo eliminado del inventario")

      deleteItem({
        id,
        previousInventory,
        request: apiClient.deleteInventoryItem(id, activeRestaurant.id),
      })
    },
    [activeRestaurant.id, activeRestaurant.inventory, updateActiveRestaurantRecord, deleteItem]
  )

  const adjustStock = useCallback(
    (id: string, deltaQuantity: number) => {
      const target = (activeRestaurant?.inventory || []).find((i) => i.id === id)
      if (!target) return
      // Delta actually applied optimistically (the local stock never goes below 0).
      const newStock = Math.max(0, round(target.currentStock + deltaQuantity))
      const appliedDelta = round(newStock - target.currentStock)

      updateActiveRestaurantRecord((current) => ({
        ...current,
        inventory: (current.inventory || []).map((item) =>
          item.id === id
            ? {
                ...item,
                currentStock: Math.max(0, round(item.currentStock + deltaQuantity)),
                lastRestockedAt: deltaQuantity > 0 ? new Date().toISOString() : item.lastRestockedAt,
              }
            : item
        ),
      }))
      if (deltaQuantity > 0) {
        toast.success(`+${deltaQuantity} añadido a "${target.name}" (Total: ${newStock})`)
      } else {
        toast.info(`${deltaQuantity} descontado de "${target.name}" (Total: ${newStock})`)
      }

      adjustItemStock({
        id,
        appliedDelta,
        request: apiClient.updateInventoryStock(id, deltaQuantity, activeRestaurant.id),
      })
    },
    [activeRestaurant.id, activeRestaurant.inventory, updateActiveRestaurantRecord, adjustItemStock]
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

      createSupplierRequest({
        tempId,
        request: apiClient.createSupplier(supplier, activeRestaurant.id),
      })
    },
    [activeRestaurant.id, updateActiveRestaurantRecord, createSupplierRequest]
  )

  const updateSupplier = useCallback(
    (id: string, updates: Partial<Supplier>) => {
      const snapshot = { previous: [] as Supplier[] }
      updateActiveRestaurantRecord((current) => {
        snapshot.previous = current.suppliers || []
        return {
          ...current,
          suppliers: (current.suppliers || []).map((sup) =>
            sup.id === id ? { ...sup, ...updates } : sup
          ),
        }
      })
      toast.success("Proveedor actualizado")

      updateSupplierRequest({
        snapshot,
        request: apiClient.updateSupplier(id, updates, activeRestaurant.id),
      })
    },
    [activeRestaurant.id, updateActiveRestaurantRecord, updateSupplierRequest]
  )

  const deleteSupplier = useCallback(
    (id: string) => {
      const snapshot = { previous: [] as Supplier[] }
      updateActiveRestaurantRecord((current) => {
        snapshot.previous = current.suppliers || []
        return {
          ...current,
          suppliers: (current.suppliers || []).filter((sup) => sup.id !== id),
        }
      })
      toast.success("Proveedor eliminado")

      deleteSupplierRequest({
        snapshot,
        request: apiClient.deleteSupplier(id, activeRestaurant.id),
      })
    },
    [activeRestaurant.id, updateActiveRestaurantRecord, deleteSupplierRequest]
  )

  const lowStockCount = useMemo(() => {
    return inventory.filter((item) => item.currentStock <= item.minStockAlert).length
  }, [inventory])

  const totalInventoryValue = useMemo(() => {
    return inventory.reduce((sum, item) => sum + item.currentStock * item.costPerUnit, 0)
  }, [inventory])

  const value: InventoryContextType = useMemo(
    () => ({
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
    }),
    [
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
    ]
  )

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
}

export const useInventory = (): InventoryContextType => {
  const context = useContext(InventoryContext)
  if (!context) {
    throw new Error("useInventory must be used within an InventoryProvider")
  }
  return context
}
