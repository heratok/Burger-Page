import React, { createContext, useContext, useCallback, useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { StorefrontConfig, MenuItem, AdditionItem } from "@/types/restaurant"
import { DEFAULT_STORE_CONFIG } from "@/constants/themePresets"
import { useTenant } from "./TenantContext"
import { useAuth } from "./AuthContext"
import { apiClient, isNotFoundError } from "@/core/api/apiClient"
import { toast } from "sonner"
import { nextTempId } from "@/lib/ids"
import { splitConfigForApi } from "@/lib/storeSchedule"
import { keys, keyPrefixes } from "@/core/query/keys"
import { patchRestaurant } from "./restaurantCache"
import {
  productsQueryOptions,
  additionsQueryOptions,
  CATALOG_WRITES_KEY,
  TENANT_WRITES_KEY,
} from "@/core/query/options"

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
  isLoadingCatalog: boolean
}

const CatalogContext = createContext<CatalogContextType | undefined>(undefined)

const warn = (message: string, err: unknown) => {
  if (import.meta.env?.MODE !== "test") {
    console.warn(message, err)
  }
}

/** The editable catalog: cached products and additions, stored categories. */
interface CatalogState {
  products: MenuItem[]
  additions: AdditionItem[]
  /** Owner-created categories (tenant directory data, not a query). */
  categories: string[]
}

/**
 * One optimistic catalog write. The catalog mutation applies it in onMutate,
 * undoes it in onError and revalidates in onSettled. The request is already
 * dispatched: the HTTP call fires at the user action (as before).
 */
interface CatalogEdit {
  apply: (state: CatalogState) => CatalogState
  /** Undoes the edit on the current state; `snapshot` is the state before it. */
  rollback: (state: CatalogState, snapshot: CatalogState) => CatalogState
  request: Promise<unknown>
  /** Applies the server's answer (e.g. temp id -> real id). */
  reconcile?: (state: CatalogState, result: any) => CatalogState
  toast: { success?: string; info?: string; error: string }
  /** A failure this returns true for is ignored: no rollback, no error toast. */
  skipRollbackIfError?: (err: unknown) => boolean
  warnMessage: string
}

/** One optimistic store-config write (design/settings of the tenant record). */
interface ConfigWrite {
  apply: (config: StorefrontConfig) => StorefrontConfig
  request: Promise<unknown>
  toast: { success?: string; info?: string; error: string }
  warnMessage: string
}

const EMPTY_PRODUCTS: MenuItem[] = []
const EMPTY_ADDITIONS: AdditionItem[] = []

export const CatalogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeRestaurant } = useTenant()
  const { session } = useAuth()

  // A1/A2: fetch targets key on the session-aware effective tenant. For a
  // restaurant admin the session binds the fetch to THEIR restaurant even when
  // a stale persisted activeRestaurant is present in the envelope.
  const effectiveId =
    (session.role === "restaurant" || session.role === "staff") && session.restaurantId
      ? session.restaurantId
      : activeRestaurant?.id

  // The slug is only trustworthy when it belongs to the effective tenant record
  // (avoids sending another tenant's slug when the memo fell back to [0]).
  const effectiveSlug =
    activeRestaurant && activeRestaurant.id === effectiveId
      ? activeRestaurant.slug
      : undefined

  const queryClient = useQueryClient()

  // Same gating as before the migration: a tenant is needed (and never the
  // placeholder default one). There is deliberately NO token requirement: the
  // public storefront (anonymous visitors) reads the menu through the same
  // public by-slug endpoints. The role and slug are part of the key so a cache
  // entry is never served across roles or across slug resolutions.
  const enabled = Boolean(effectiveId && effectiveId !== "rest-default")

  const productsQuery = useQuery({
    ...productsQueryOptions(effectiveId, session.role, effectiveSlug),
    enabled,
  })
  const additionsQuery = useQuery({
    ...additionsQueryOptions(effectiveId, session.role, effectiveSlug),
    enabled,
  })

  // Initial read only (isLoading = no data yet and fetching); background
  // refetches after writes must not flash the loading state.
  const isLoadingCatalog = enabled && (productsQuery.isLoading || additionsQuery.isLoading)

  // The query cache is the only source of truth for products and additions: a
  // failed read keeps the last cached lists, and the tenant record never holds
  // them. Stored categories stay with the tenant record.
  const productsKey = useMemo(
    () => keys.products(effectiveId, session.role, effectiveSlug),
    [effectiveId, session.role, effectiveSlug]
  )
  const additionsKey = useMemo(
    () => keys.additions(effectiveId, session.role, effectiveSlug),
    [effectiveId, session.role, effectiveSlug]
  )
  const products = productsQuery.data ?? EMPTY_PRODUCTS
  const additions = additionsQuery.data ?? EMPTY_ADDITIONS
  const storedCategories = activeRestaurant.categories

  const readCatalog = useCallback(
    (): CatalogState => ({
      products: queryClient.getQueryData<MenuItem[]>(productsKey) ?? EMPTY_PRODUCTS,
      additions: queryClient.getQueryData<AdditionItem[]>(additionsKey) ?? EMPTY_ADDITIONS,
      categories: storedCategories ?? [],
    }),
    [queryClient, productsKey, additionsKey, storedCategories]
  )
  /** Writes what an edit changed: lists to the cache, categories to the tenant record. */
  const writeCatalog = useCallback(
    (update: (state: CatalogState) => CatalogState) => {
      const current = readCatalog()
      const next = update(current)
      if (next.products !== current.products) queryClient.setQueryData(productsKey, next.products)
      if (next.additions !== current.additions) queryClient.setQueryData(additionsKey, next.additions)
      if (next.categories !== current.categories) {
        if (effectiveId) {
          patchRestaurant(queryClient, session.role, effectiveId, (record) => ({ ...record, categories: next.categories }))
        }
      }
    },
    [readCatalog, queryClient, productsKey, additionsKey, effectiveId, session.role]
  )

  // After the LAST in-flight catalog write settles, pull the authoritative
  // server state of every catalog resource (the settling mutation counts
  // itself, hence > 1). One shared key plus invalidating all resources means
  // no resource can be left unrevalidated by another one's write.
  const revalidate = useCallback(() => {
    if (queryClient.isMutating({ mutationKey: CATALOG_WRITES_KEY }) > 1) return
    void queryClient.invalidateQueries({ queryKey: keyPrefixes.products(effectiveId) })
    void queryClient.invalidateQueries({ queryKey: keyPrefixes.additions(effectiveId) })
  }, [queryClient, effectiveId])

  // onMutate cancels in-flight catalog reads, keeps the pre-write state as the
  // context and applies the edit synchronously (same render as the action);
  // onError restores it (also offline: mutations run with networkMode
  // "always"); onSettled asks for the single revalidation.
  const { mutate: runCatalogEdit } = useMutation({
    mutationKey: CATALOG_WRITES_KEY,
    mutationFn: (edit: CatalogEdit) => edit.request,
    onMutate: (edit) => {
      void queryClient.cancelQueries({ queryKey: productsKey })
      void queryClient.cancelQueries({ queryKey: additionsKey })
      const snapshot = readCatalog()
      writeCatalog(edit.apply)
      if (edit.toast.success) {
        toast.success(edit.toast.success)
      } else if (edit.toast.info) {
        toast.info(edit.toast.info)
      }
      return { snapshot }
    },
    onSuccess: (result, edit) => {
      // The server already committed: a client-side reconciliation bug must
      // never roll back or report a failure.
      try {
        if (edit.reconcile) writeCatalog((state) => edit.reconcile!(state, result))
      } catch (reconcileErr) {
        console.error("CatalogContext: onSuccess reconciliation failed", reconcileErr)
      }
    },
    onError: (err, edit, context) => {
      if (edit.skipRollbackIfError?.(err)) return
      warn(edit.warnMessage, err)
      if (context) writeCatalog((state) => edit.rollback(state, context.snapshot))
      toast.error(edit.toast.error)
    },
    onSettled: () => revalidate(),
  })

  /** Dispatches the HTTP call at the user action and runs the catalog edit. */
  const runWrite = useCallback(
    (edit: Omit<CatalogEdit, "request"> & { call: () => Promise<unknown> }) => {
      let request: Promise<unknown>
      try {
        request = edit.call()
      } catch (err) {
        request = Promise.reject(err)
      }
      // The mutation owns the rejection; this only avoids a transient
      // unhandled-rejection report before it subscribes.
      request.catch(() => undefined)
      runCatalogEdit({ ...edit, request })
    },
    [runCatalogEdit]
  )

  // Store config is tenant record data: its writes share TENANT_WRITES_KEY
  // with the restaurant edits, so a directory read that lands while one is
  // pending is deferred instead of reverting it, and the settled write marks
  // the cached restaurant lookups stale (TenantContext's write listener).
  const { mutate: writeConfig } = useMutation({
    mutationKey: TENANT_WRITES_KEY,
    mutationFn: (vars: ConfigWrite) => vars.request,
    onMutate: (vars) => {
      // The store config is read from the restaurant's keys.restaurant entry:
      // a lookup in flight predates the write, and every cached copy of the
      // restaurant gets the optimistic config.
      void queryClient.cancelQueries({ queryKey: keyPrefixes.restaurant() })
      const previousConfig = activeRestaurant?.config
      if (effectiveId) {
        patchRestaurant(queryClient, session.role, effectiveId, (current) => ({
          ...current,
          config: vars.apply(current.config),
        }))
      }
      if (vars.toast.success) toast.success(vars.toast.success)
      else if (vars.toast.info) toast.info(vars.toast.info)
      return { previousConfig }
    },
    onError: (err, vars, context) => {
      warn(vars.warnMessage, err)
      const previousConfig = context?.previousConfig
      if (previousConfig && effectiveId) {
        patchRestaurant(queryClient, session.role, effectiveId, (current) => ({ ...current, config: previousConfig }))
      }
      toast.error(vars.toast.error)
    },
  })

  /** Fires the config request at the user action and runs the tracked write. */
  const runConfigWrite = useCallback(
    (write: Omit<ConfigWrite, "request"> & { call: () => Promise<unknown> }) => {
      let request: Promise<unknown>
      try {
        request = write.call()
      } catch (err) {
        request = Promise.reject(err)
      }
      request.catch(() => undefined)
      writeConfig({ ...write, request })
    },
    [writeConfig]
  )

  const updateStoreConfig = useCallback(
    (newConfig: Partial<StorefrontConfig>) => {
      const restaurantId = activeRestaurant?.id
      runConfigWrite({
        apply: (config) => ({ ...config, ...newConfig }),
        call: () =>
          restaurantId ? apiClient.updateRestaurant(restaurantId, splitConfigForApi(newConfig)) : Promise.resolve(undefined),
        toast: {
          success: "Diseño y configuración actualizados",
          error: "Error al guardar la configuración en el servidor",
        },
        warnMessage: "Could not persist store config to backend API:",
      })
    },
    [activeRestaurant?.id, runConfigWrite]
  )

  const resetStoreConfig = useCallback(() => {
    const restaurantId = activeRestaurant?.id
    runConfigWrite({
      apply: (config) => ({
        ...DEFAULT_STORE_CONFIG,
        // Resetting the design never touches the opening hours or the pause.
        schedule: config.schedule,
        timezone: config.timezone,
        ordersPaused: config.ordersPaused,
      }),
      call: () =>
        restaurantId
          ? apiClient.updateRestaurant(restaurantId, { config: splitConfigForApi(DEFAULT_STORE_CONFIG).config })
          : Promise.resolve(undefined),
      toast: { info: "Diseño restablecido a los valores por defecto", error: "Error al restablecer la configuración en el servidor" },
      warnMessage: "Could not persist reset store config to backend API:",
    })
  }, [activeRestaurant?.id, runConfigWrite])

  const addProduct = useCallback(
    (item: Omit<MenuItem, "id">) => {
      const tempId = nextTempId("prod")
      const newItem: MenuItem = { ...item, id: tempId }

      runWrite({
        apply: (state) => ({ ...state, products: [newItem, ...state.products] }),
        call: () =>
          apiClient.createProduct({
            restaurantId: activeRestaurant.id,
            name: item.name,
            description: item.description,
            price: item.price,
            category: item.category,
            imageUrl: item.src,
            isAvailable: item.inStock,
            isPopular: item.isPopular,
            isNew: item.isNew,
            preparationTimeMinutes: item.preparationTimeMinutes,
          }),
        reconcile: (state, created) => ({
          ...state,
          products: state.products.map((p) => (p.id === tempId ? created : p)),
        }),
        rollback: (state) => ({ ...state, products: state.products.filter((p) => p.id !== tempId) }),
        toast: { success: `"${item.name}" agregado al menú`, error: "Error al guardar producto en el servidor" },
        warnMessage: "Could not persist product to backend API:",
      })
    },
    [activeRestaurant.id, runWrite]
  )

  const updateProduct = useCallback(
    (id: string, updates: Partial<MenuItem>) => {
      runWrite({
        apply: (state) => ({
          ...state,
          products: state.products.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        }),
        call: () => {
          const payload: Record<string, unknown> = {}
          if (updates.name !== undefined) payload.name = updates.name
          if (updates.description !== undefined) payload.description = updates.description
          if (updates.price !== undefined) payload.price = updates.price
          if (updates.category !== undefined) payload.category = updates.category
          if (updates.src !== undefined) payload.imageUrl = updates.src
          if (updates.inStock !== undefined) payload.isAvailable = updates.inStock
          if (updates.isPopular !== undefined) payload.isPopular = updates.isPopular
          if (updates.isNew !== undefined) payload.isNew = updates.isNew
          if (updates.preparationTimeMinutes !== undefined) payload.preparationTimeMinutes = updates.preparationTimeMinutes
          return apiClient.updateProduct(id, payload, activeRestaurant.id)
        },
        rollback: (state, snapshot) => ({ ...state, products: snapshot.products }),
        toast: { success: "Producto actualizado", error: "Error al actualizar producto en el servidor" },
        warnMessage: "Could not update product in backend API:",
      })
    },
    [activeRestaurant.id, runWrite]
  )

  const deleteProduct = useCallback(
    (id: string) => {
      runWrite({
        apply: (state) => ({ ...state, products: state.products.filter((p) => p.id !== id) }),
        call: () => apiClient.deleteProduct(id, activeRestaurant.id),
        rollback: (state, snapshot) => ({ ...state, products: snapshot.products }),
        toast: { success: "Producto eliminado del menú", error: "Error al eliminar producto del servidor" },
        skipRollbackIfError: isNotFoundError,
        warnMessage: "Could not delete product from backend API:",
      })
    },
    [activeRestaurant.id, runWrite]
  )

  const toggleProductStock = useCallback(
    (id: string) => {
      const target = products.find((p) => p.id === id)
      if (!target) return
      // Computed from current state OUTSIDE any updater (updaters must be pure).
      const isNowInStock = !target.inStock

      runWrite({
        apply: (state) => ({
          ...state,
          products: state.products.map((p) => (p.id === id ? { ...p, inStock: isNowInStock } : p)),
        }),
        call: () => apiClient.updateProduct(id, { isAvailable: isNowInStock }, activeRestaurant.id),
        // Roll back only this product's availability, from current state.
        rollback: (state) => ({
          ...state,
          products: state.products.map((p) => (p.id === id ? { ...p, inStock: !isNowInStock } : p)),
        }),
        toast: {
          info: `Producto marcado como ${isNowInStock ? "Disponible" : "Agotado"}`,
          error: "Error al actualizar disponibilidad en el servidor",
        },
        warnMessage: "Could not update product availability in backend API:",
      })
    },
    [activeRestaurant.id, products, runWrite]
  )

  const addAddition = useCallback(
    (item: Omit<AdditionItem, "id">) => {
      const tempId = nextTempId("add")
      const newItem: AdditionItem = { ...item, id: tempId }
      const targetRestId = activeRestaurant?.id

      runWrite({
        apply: (state) => ({ ...state, additions: [...state.additions, newItem] }),
        call: () =>
          apiClient.createAddition({
            name: item.name,
            price: item.price,
            isAvailable: item.available,
            restaurantId: targetRestId,
          }),
        reconcile: (state, created) => ({
          ...state,
          additions: state.additions.map((a) => (a.id === tempId ? created : a)),
        }),
        rollback: (state) => ({ ...state, additions: state.additions.filter((a) => a.id !== tempId) }),
        toast: { success: `Adicional "${item.name}" creado`, error: "Error al guardar adicional en el servidor" },
        warnMessage: "Could not persist addition to backend API:",
      })
    },
    [activeRestaurant?.id, runWrite]
  )

  const updateAddition = useCallback(
    (id: string, updates: Partial<AdditionItem>) => {
      const targetRestId = activeRestaurant?.id
      runWrite({
        apply: (state) => ({
          ...state,
          additions: state.additions.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        }),
        call: () =>
          apiClient.updateAddition(id, {
            name: updates.name,
            price: updates.price,
            isAvailable: updates.available,
            restaurantId: targetRestId,
          }),
        rollback: (state, snapshot) => ({ ...state, additions: snapshot.additions }),
        toast: { success: "Adicional actualizado", error: "Error al actualizar adicional en el servidor" },
        warnMessage: "Could not update addition in backend API:",
      })
    },
    [activeRestaurant?.id, runWrite]
  )

  const deleteAddition = useCallback(
    (id: string) => {
      const targetRestId = activeRestaurant?.id
      runWrite({
        apply: (state) => ({ ...state, additions: state.additions.filter((a) => a.id !== id) }),
        call: () => apiClient.deleteAddition(id, targetRestId),
        rollback: (state, snapshot) => ({ ...state, additions: snapshot.additions }),
        toast: { success: "Adicional eliminado", error: "Error al eliminar adicional del servidor" },
        skipRollbackIfError: isNotFoundError,
        warnMessage: "Could not delete addition from backend API:",
      })
    },
    [activeRestaurant?.id, runWrite]
  )

  // The category list is the UNION of owner-created categories and the
  // categories present on products, deduplicated. This is the exact set the
  // modal, the filter (useMenuFilter) and deleteCategory's guard all see, so
  // they can never disagree. It may legitimately be empty (a restaurant with
  // zero categories): no default is fabricated here.
  const categories = useMemo(() => {
    const stored = storedCategories || []
    const fromProducts = products.map((p) => p.category).filter(Boolean)
    return Array.from(new Set([...stored, ...fromProducts]))
  }, [storedCategories, products])

  const addCategory = useCallback(
    (categoryName: string) => {
      const trimmed = categoryName.trim()
      if (!trimmed) {
        toast.error("El nombre de la categoría no puede estar vacío")
        return
      }
      if (categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
        toast.warning(`La categoría "${trimmed}" ya existe`)
        return
      }
      const previousCategories = categories
      const nextCategories = [...categories, trimmed]

      runWrite({
        apply: (state) => ({ ...state, categories: nextCategories }),
        call: () => apiClient.updateCategories(nextCategories, activeRestaurant.slug || activeRestaurant.id),
        rollback: (state) => ({ ...state, categories: previousCategories }),
        toast: { success: `Categoría "${trimmed}" creada`, error: "Error al guardar categoría en el servidor" },
        warnMessage: "Could not sync categories to backend API:",
      })
    },
    [categories, activeRestaurant.slug, activeRestaurant.id, runWrite]
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
      if (categories.some((c) => c.toLowerCase() === trimmedNew.toLowerCase() && c.toLowerCase() !== oldName.toLowerCase())) {
        toast.warning(`Ya existe una categoría llamada "${trimmedNew}"`)
        return
      }
      const previousCategories = categories
      const previousProducts = products

      const nextCategories = categories.map((c) => (c.toLowerCase() === oldName.toLowerCase() ? trimmedNew : c))
      const nextProducts = previousProducts.map((p) =>
        p.category?.toLowerCase() === oldName.toLowerCase() ? { ...p, category: trimmedNew } : p
      )

      runWrite({
        apply: (state) => ({ ...state, categories: nextCategories, products: nextProducts }),
        // Single server operation: the backend renames the category row in
        // place, so its products keep their category (no per-product updates).
        call: () =>
          apiClient.updateCategories(nextCategories, activeRestaurant.slug || activeRestaurant.id, [
            { from: oldName, to: trimmedNew },
          ]),
        rollback: (state) => ({ ...state, categories: previousCategories, products: previousProducts }),
        toast: { success: `Categoría renombrada a "${trimmedNew}"`, error: "Error al renombrar categoría en el servidor" },
        warnMessage: "Could not sync categories to backend API:",
      })
    },
    [categories, products, activeRestaurant.slug, activeRestaurant.id, runWrite]
  )

  const deleteCategory = useCallback(
    (categoryName: string) => {
      // Rule (ii): the LAST category cannot be deleted while it still has
      // products assigned. If it has none, deletion is allowed and the list
      // may become empty. The guard validates the SAME union list the UI shows.
      const hasProducts = products.some((p) => p.category === categoryName)
      if (categories.length <= 1 && hasProducts) {
        toast.error(
          "No se puede eliminar la última categoría porque tiene productos asignados. Mové o eliminá esos productos primero."
        )
        return
      }
      const previousCategories = categories
      const previousProducts = products

      const nextCategories = categories.filter((c) => c !== categoryName)
      // No fabricated fallback: only reassign products when a target exists.
      const fallback = nextCategories[0]
      const nextProducts = fallback
        ? previousProducts.map((p) =>
            p.category === categoryName ? { ...p, category: fallback } : p
          )
        : previousProducts

      runWrite({
        apply: (state) => ({ ...state, categories: nextCategories, products: nextProducts }),
        call: async () => {
          // Sync affected products to backend API (only when a reassignment target exists).
          // Fire-and-forget: a lone product's resync failing never blocks or
          // rolls back the category deletion itself.
          const resyncs: Promise<unknown>[] = []
          if (fallback) {
            const affectedProducts = previousProducts.filter((p) => p.category === categoryName)
            for (const prod of affectedProducts) {
              resyncs.push(
                apiClient.updateProduct(prod.id, { category: fallback }, activeRestaurant.id).catch((err) => {
                  warn("Could not sync reassigned product to backend API:", err)
                })
              )
            }
          }
          const result = await apiClient.updateCategories(nextCategories, activeRestaurant.slug || activeRestaurant.id)
          // Settle only after the resyncs finish so the revalidation that
          // follows never reads products that still have the deleted category.
          await Promise.all(resyncs)
          return result
        },
        rollback: (state) => ({ ...state, categories: previousCategories, products: previousProducts }),
        toast: { success: `Categoría "${categoryName}" eliminada`, error: "Error al eliminar categoría del servidor" },
        warnMessage: "Could not sync categories to backend API:",
      })
    },
    [categories, products, activeRestaurant.slug, activeRestaurant.id, runWrite]
  )

  const value: CatalogContextType = useMemo(
    () => ({
      storeConfig: activeRestaurant.config,
      updateStoreConfig,
      resetStoreConfig,
      categories,
      addCategory,
      updateCategory,
      deleteCategory,
      products,
      addProduct,
      updateProduct,
      deleteProduct,
      toggleProductStock,
      additions,
      addAddition,
      updateAddition,
      deleteAddition,
      isLoadingCatalog,
    }),
    [
      activeRestaurant.config,
      updateStoreConfig,
      resetStoreConfig,
      categories,
      addCategory,
      updateCategory,
      deleteCategory,
      products,
      addProduct,
      updateProduct,
      deleteProduct,
      toggleProductStock,
      additions,
      addAddition,
      updateAddition,
      deleteAddition,
      isLoadingCatalog,
    ]
  )

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}

export const useCatalog = (): CatalogContextType => {
  const context = useContext(CatalogContext)
  if (!context) {
    throw new Error("useCatalog must be used within a CatalogProvider")
  }
  return context
}
