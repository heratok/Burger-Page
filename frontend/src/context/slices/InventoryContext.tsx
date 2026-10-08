import React, { createContext, useContext, useCallback, useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { InventoryItem, Supplier } from "@/types/restaurant"
import { apiClient, isNotFoundError } from "@/core/api/apiClient"
import { useTenant } from "./TenantContext"
import { useAuth } from "./AuthContext"
import { toast } from "sonner"
import { nextTempId } from "@/lib/ids"
import { keys, keyPrefixes } from "@/core/query/keys"
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
  newItem: InventoryItem
}
interface UpdateItemVars extends WithRequest<unknown> {
  id: string
  updates: Partial<InventoryItem>
  fallbackName: string | undefined
}
interface DeleteItemVars extends WithRequest<unknown> {
  id: string
}
interface AdjustStockVars extends WithRequest<unknown> {
  id: string
  deltaQuantity: number
}
interface CreateSupplierVars extends WithRequest<Sup> {
  newSupplier: Supplier
}
interface UpdateSupplierVars extends WithRequest<unknown> {
  id: string
  updates: Partial<Supplier>
}
interface DeleteSupplierVars extends WithRequest<unknown> {
  id: string
}

const EMPTY_INVENTORY: InventoryItem[] = []
const EMPTY_SUPPLIERS: Supplier[] = []

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeRestaurant } = useTenant()
  const { session } = useAuth()
  const queryClient = useQueryClient()

  // A1/A2: the inventory fetch keys on the session-aware effective tenant so a
  // restaurant admin's first render never pulls another tenant's stock.
  const effectiveId =
    (session.role === "restaurant" || session.role === "staff") && session.restaurantId
      ? session.restaurantId
      : activeRestaurant?.id


  // No tenant or no token, no fetch. The role is part of the key so a cache
  // entry can never be served across roles.
  const enabled = Boolean(effectiveId && apiClient.hasToken())
  const inventoryKey = useMemo(() => keys.inventory(effectiveId, session.role), [effectiveId, session.role])
  const suppliersKey = useMemo(() => keys.suppliers(effectiveId, session.role), [effectiveId, session.role])

  const inventoryQuery = useQuery({ ...inventoryQueryOptions(effectiveId, session.role), enabled })
  const suppliersQuery = useQuery({ ...suppliersQueryOptions(effectiveId, session.role), enabled })

  // Initial read only (isLoading = no data yet and fetching); background
  // refetches after writes must not flash the loading state.
  const isLoadingInventory = enabled && (inventoryQuery.isLoading || suppliersQuery.isLoading)

  // The query cache is the only source of truth: a failed read keeps the last
  // cached lists, and the tenant record never holds stock or suppliers.
  const inventory: InventoryItem[] = inventoryQuery.data ?? EMPTY_INVENTORY
  const suppliers: Supplier[] = suppliersQuery.data ?? EMPTY_SUPPLIERS

  /** Local change to the cached inventory (optimistic write or rollback). */
  const setInventory = useCallback(
    (updater: (current: InventoryItem[]) => InventoryItem[]) => {
      queryClient.setQueryData<InventoryItem[]>(inventoryKey, (current) => updater(current ?? EMPTY_INVENTORY))
    },
    [queryClient, inventoryKey]
  )
  const setSuppliers = useCallback(
    (updater: (current: Supplier[]) => Supplier[]) => {
      queryClient.setQueryData<Supplier[]>(suppliersKey, (current) => updater(current ?? EMPTY_SUPPLIERS))
    },
    [queryClient, suppliersKey]
  )
  /** A read in flight predates the write: cancel it (the settle revalidation re-reads). */
  const cancelReads = useCallback(
    (key: readonly unknown[]) => {
      void queryClient.cancelQueries({ queryKey: key })
    },
    [queryClient]
  )

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

  // Each mutation applies its optimistic change in onMutate (synchronously, in
  // the same render as the user action) and owns its rollback in onError.
  const { mutate: createItem } = useMutation({
    mutationKey: MUTATION_KEY,
    mutationFn: (vars: CreateItemVars) => vars.request,
    onMutate: ({ newItem }) => {
      cancelReads(inventoryKey)
      setInventory((current) => [newItem, ...current])
    },
    onSuccess: (created, { newItem }) => {
      if (created && created.id) {
        setInventory((current) => current.map((i) => (i.id === newItem.id ? created : i)))
      }
    },
    onError: (err, { newItem }) => {
      warn("Could not persist inventory item to backend API:", err)
      // Remove only the optimistic item; other concurrent changes stay.
      setInventory((current) => current.filter((i) => i.id !== newItem.id))
      toast.error(conflictMessage(err, newItem.name, "Error al guardar insumo en el servidor"))
    },
    onSettled: () => revalidate("inventory"),
  })

  const { mutate: updateItem } = useMutation({
    mutationKey: MUTATION_KEY,
    mutationFn: (vars: UpdateItemVars) => vars.request,
    onMutate: ({ id, updates }) => {
      cancelReads(inventoryKey)
      // Remember only this item's previous values for the touched fields.
      const target = (queryClient.getQueryData<InventoryItem[]>(inventoryKey) ?? EMPTY_INVENTORY).find(
        (i) => i.id === id
      )
      const previousFields: Record<string, unknown> = {}
      if (target) {
        for (const key of Object.keys(updates) as (keyof InventoryItem)[]) {
          previousFields[key] = target[key]
        }
      }
      setInventory((current) => current.map((item) => (item.id === id ? { ...item, ...updates } : item)))
      return { previousFields }
    },
    onError: (error, { id, fallbackName }, context) => {
      warn(`Could not sync inventory item ${id} updates to backend:`, error)
      setInventory((current) =>
        current.map((item) => (item.id === id ? { ...item, ...context?.previousFields } : item))
      )
      toast.error(conflictMessage(error, fallbackName, "Error al actualizar insumo en el servidor"))
    },
    onSettled: () => revalidate("inventory"),
  })

  const { mutate: deleteItem } = useMutation({
    mutationKey: MUTATION_KEY,
    mutationFn: (vars: DeleteItemVars) => vars.request,
    onMutate: ({ id }) => {
      cancelReads(inventoryKey)
      const previousInventory = queryClient.getQueryData<InventoryItem[]>(inventoryKey) ?? EMPTY_INVENTORY
      setInventory((current) => current.filter((item) => item.id !== id))
      return { previousInventory }
    },
    onError: (error, { id }, context) => {
      if (isNotFoundError(error)) {
        // Resource already absent on server: preserve client deletion without rollback
        return
      }
      warn(`Could not delete inventory item ${id} from backend:`, error)
      if (context) setInventory(() => context.previousInventory)
      toast.error("Error al eliminar insumo del servidor")
    },
    onSettled: () => revalidate("inventory"),
  })

  const { mutate: adjustItemStock } = useMutation({
    mutationKey: MUTATION_KEY,
    mutationFn: (vars: AdjustStockVars) => vars.request,
    onMutate: ({ id, deltaQuantity }) => {
      cancelReads(inventoryKey)
      const target = (queryClient.getQueryData<InventoryItem[]>(inventoryKey) ?? EMPTY_INVENTORY).find(
        (i) => i.id === id
      )
      // Delta actually applied optimistically (the local stock never goes below 0).
      const appliedDelta = target
        ? round(Math.max(0, round(target.currentStock + deltaQuantity)) - target.currentStock)
        : 0
      setInventory((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                currentStock: Math.max(0, round(item.currentStock + deltaQuantity)),
                lastRestockedAt: deltaQuantity > 0 ? new Date().toISOString() : item.lastRestockedAt,
              }
            : item
        )
      )
      return { appliedDelta }
    },
    onError: (error, { id }, context) => {
      warn(`Could not sync adjust stock for ${id} to backend:`, error)
      // Undo only this adjust, relative to the CURRENT state, so other
      // accepted adjusts and edits are preserved.
      const appliedDelta = context?.appliedDelta ?? 0
      setInventory((current) =>
        current.map((item) =>
          item.id === id ? { ...item, currentStock: Math.max(0, round(item.currentStock - appliedDelta)) } : item
        )
      )
      toast.error("Error al sincronizar el inventario con el servidor")
    },
    onSettled: () => revalidate("inventory"),
  })

  const { mutate: createSupplierRequest } = useMutation({
    mutationKey: MUTATION_KEY,
    mutationFn: (vars: CreateSupplierVars) => vars.request,
    onMutate: ({ newSupplier }) => {
      cancelReads(suppliersKey)
      setSuppliers((current) => [newSupplier, ...current])
    },
    onSuccess: (created, { newSupplier }) => {
      if (created?.id) {
        setSuppliers((current) => current.map((s) => (s.id === newSupplier.id ? created : s)))
      }
    },
    onError: (err, { newSupplier }) => {
      warn("Could not sync supplier creation to backend API:", err)
      setSuppliers((current) => current.filter((s) => s.id !== newSupplier.id))
      toast.error("Error al registrar proveedor en el servidor")
    },
    onSettled: () => revalidate("suppliers"),
  })

  const { mutate: updateSupplierRequest } = useMutation({
    mutationKey: MUTATION_KEY,
    mutationFn: (vars: UpdateSupplierVars) => vars.request,
    onMutate: ({ id, updates }) => {
      cancelReads(suppliersKey)
      const previous = queryClient.getQueryData<Supplier[]>(suppliersKey) ?? EMPTY_SUPPLIERS
      setSuppliers((current) => current.map((sup) => (sup.id === id ? { ...sup, ...updates } : sup)))
      return { previous }
    },
    onError: (err, _vars, context) => {
      warn("Could not sync supplier update to backend API:", err)
      if (context) setSuppliers(() => context.previous)
      toast.error("Error al actualizar proveedor en el servidor")
    },
    onSettled: () => revalidate("suppliers"),
  })

  const { mutate: deleteSupplierRequest } = useMutation({
    mutationKey: MUTATION_KEY,
    mutationFn: (vars: DeleteSupplierVars) => vars.request,
    onMutate: ({ id }) => {
      cancelReads(suppliersKey)
      const previous = queryClient.getQueryData<Supplier[]>(suppliersKey) ?? EMPTY_SUPPLIERS
      setSuppliers((current) => current.filter((sup) => sup.id !== id))
      return { previous }
    },
    onError: (err, _vars, context) => {
      warn("Could not sync supplier deletion to backend API:", err)
      if (context) setSuppliers(() => context.previous)
      toast.error("Error al eliminar proveedor en el servidor")
    },
    onSettled: () => revalidate("suppliers"),
  })

  // The HTTP call fires at the user action (as before); the mutation applies
  // the optimistic change and owns persist/rollback.
  const addInventoryItem = useCallback(
    (item: Omit<InventoryItem, "id">) => {
      const newItem: InventoryItem = {
        ...item,
        id: nextTempId("inv"),
        lastRestockedAt: new Date().toISOString(),
      }
      createItem({
        newItem,
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
      toast.success(`Insumo "${item.name}" agregado al inventario`)
    },
    [activeRestaurant.id, createItem]
  )

  const updateInventoryItem = useCallback(
    (id: string, updates: Partial<InventoryItem>) => {
      const target = inventory.find((i) => i.id === id)
      const payload: Record<string, unknown> = { ...updates }
      if (updates.currentStock !== undefined) {
        payload.quantity = updates.currentStock
        delete payload.currentStock
      }
      updateItem({
        id,
        updates,
        fallbackName: updates.name ?? target?.name,
        request: apiClient.updateInventoryItem(id, payload as any, activeRestaurant.id),
      })
      toast.success("Insumo actualizado")
    },
    [activeRestaurant.id, inventory, updateItem]
  )

  const deleteInventoryItem = useCallback(
    (id: string) => {
      deleteItem({ id, request: apiClient.deleteInventoryItem(id, activeRestaurant.id) })
      toast.success("Insumo eliminado del inventario")
    },
    [activeRestaurant.id, deleteItem]
  )

  const adjustStock = useCallback(
    (id: string, deltaQuantity: number) => {
      const target = inventory.find((i) => i.id === id)
      if (!target) return
      const newStock = Math.max(0, round(target.currentStock + deltaQuantity))
      adjustItemStock({
        id,
        deltaQuantity,
        request: apiClient.updateInventoryStock(id, deltaQuantity, activeRestaurant.id),
      })
      if (deltaQuantity > 0) {
        toast.success(`+${deltaQuantity} añadido a "${target.name}" (Total: ${newStock})`)
      } else {
        toast.info(`${deltaQuantity} descontado de "${target.name}" (Total: ${newStock})`)
      }
    },
    [activeRestaurant.id, inventory, adjustItemStock]
  )

  const addSupplier = useCallback(
    (supplier: Omit<Supplier, "id">) => {
      createSupplierRequest({
        newSupplier: { ...supplier, id: nextTempId("sup") },
        request: apiClient.createSupplier(supplier, activeRestaurant.id),
      })
      toast.success(`Proveedor "${supplier.name}" registrado`)
    },
    [activeRestaurant.id, createSupplierRequest]
  )

  const updateSupplier = useCallback(
    (id: string, updates: Partial<Supplier>) => {
      updateSupplierRequest({ id, updates, request: apiClient.updateSupplier(id, updates, activeRestaurant.id) })
      toast.success("Proveedor actualizado")
    },
    [activeRestaurant.id, updateSupplierRequest]
  )

  const deleteSupplier = useCallback(
    (id: string) => {
      deleteSupplierRequest({ id, request: apiClient.deleteSupplier(id, activeRestaurant.id) })
      toast.success("Proveedor eliminado")
    },
    [activeRestaurant.id, deleteSupplierRequest]
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
