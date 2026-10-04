import React, { createContext, useContext, useCallback, useMemo, useLayoutEffect, useRef } from "react"
import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { StorefrontConfig, MenuItem, AdditionItem } from "@/types/restaurant"
import { DEFAULT_STORE_CONFIG } from "@/constants/themePresets"
import { useTenant } from "./TenantContext"
import { useAuth } from "./AuthContext"
import { apiClient, isNotFoundError } from "@/core/api/apiClient"
import { toast } from "sonner"
import { nextTempId } from "@/lib/ids"
import { splitConfigForApi } from "@/lib/storeSchedule"
import { runOptimisticMutation, type OptimisticMutationConfig } from "./optimisticMutation"

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

// Shared mutation key so settled writes can tell whether others are in flight.
const CATALOG_MUTATION_KEY = ["catalog-writes"] as const

// Every write carries its already-dispatched request: the HTTP call fires at
// the user action (as before) and the mutation tracks it for settle/rollback.
interface CatalogWrite {
  request: Promise<unknown>
  onSuccess?: (result: unknown) => void
  onFailure: (err: unknown) => void
}

export const CatalogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeRestaurant, updateActiveRestaurantRecord } = useTenant()
  const { session } = useAuth()

  // A1/A2: fetch targets key on the session-aware effective tenant. For a
  // restaurant admin the session binds the fetch to THEIR restaurant even when
  // a stale persisted activeRestaurant is present in the envelope.
  const effectiveId =
    session.role === "restaurant" && session.restaurantId
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
    queryKey: ["products", effectiveId, session.role, effectiveSlug],
    enabled,
    retry: false,
    queryFn: async () => {
      try {
        return await apiClient.fetchProducts({ restaurantId: effectiveId, slug: effectiveSlug })
      } catch (err) {
        warn("Could not fetch products from backend API:", err)
        throw err
      }
    },
  })
  const additionsQuery = useQuery({
    queryKey: ["additions", effectiveId, session.role, effectiveSlug],
    enabled,
    retry: false,
    queryFn: async () => {
      try {
        return await apiClient.fetchAdditions({ restaurantId: effectiveId, slug: effectiveSlug })
      } catch (err) {
        warn("Could not fetch additions from backend API:", err)
        throw err
      }
    },
  })

  // Initial hydration only (isLoading = no data yet and fetching); background
  // refetches after writes must not flash the loading state.
  const isLoadingCatalog = enabled && (productsQuery.isLoading || additionsQuery.isLoading)

  // The tenant record stays the offline-first store other slices persist and
  // read; query results hydrate it. A failed fetch leaves local data untouched.
  // Hydration is skipped while a catalog write is pending or the resource is
  // refetching, so a response that predates an optimistic edit can never wipe
  // it; it runs once the writes settle and the revalidation lands.
  const backendProducts = productsQuery.data
  const backendAdditions = additionsQuery.data
  const pendingWrites = useIsMutating({ mutationKey: CATALOG_MUTATION_KEY })
  const hydrated = useRef<{ products?: MenuItem[]; additions?: AdditionItem[] }>({})
  useLayoutEffect(() => {
    if (!effectiveId || effectiveId === "rest-default") return
    // Fresh reads: the hook values in the deps only schedule this effect.
    if (queryClient.isMutating({ mutationKey: CATALOG_MUTATION_KEY }) > 0) return
    const isIdle = (resource: "products" | "additions") =>
      queryClient.isFetching({ queryKey: [resource, effectiveId] }) === 0
    const products =
      Array.isArray(backendProducts) && backendProducts !== hydrated.current.products && isIdle("products")
        ? backendProducts
        : undefined
    const additions =
      Array.isArray(backendAdditions) && backendAdditions !== hydrated.current.additions && isIdle("additions")
        ? backendAdditions
        : undefined
    if (!products && !additions) return
    if (products) hydrated.current.products = products
    if (additions) hydrated.current.additions = additions
    updateActiveRestaurantRecord((current) => {
      if (current.id !== effectiveId && current.slug !== effectiveSlug) {
        return current
      }
      return {
        ...current,
        ...(products ? { products } : {}),
        ...(additions ? { additions } : {}),
      }
    })
  }, [
    effectiveId,
    effectiveSlug,
    backendProducts,
    backendAdditions,
    productsQuery.isFetching,
    additionsQuery.isFetching,
    pendingWrites,
    queryClient,
    updateActiveRestaurantRecord,
  ])

  // After the LAST in-flight catalog write settles, pull the authoritative
  // server state of every catalog resource (the settling mutation counts
  // itself, hence > 1). One shared key plus invalidating all resources means
  // no resource can be left unrevalidated by another one's write.
  const revalidate = useCallback(() => {
    if (queryClient.isMutating({ mutationKey: CATALOG_MUTATION_KEY }) > 1) return
    void queryClient.invalidateQueries({ queryKey: ["products", effectiveId] })
    void queryClient.invalidateQueries({ queryKey: ["additions", effectiveId] })
  }, [queryClient, effectiveId])

  const { mutate: trackWrite } = useMutation({
    mutationKey: CATALOG_MUTATION_KEY,
    mutationFn: (vars: CatalogWrite) => vars.request,
    onSuccess: (result, vars) => {
      try {
        vars.onSuccess?.(result)
      } catch (reconcileErr) {
        // The server already committed: a client-side reconciliation bug must
        // never roll back or report a failure.
        console.error("CatalogContext: onSuccess reconciliation failed", reconcileErr)
      }
    },
    onError: (err, vars) => vars.onFailure(err),
    onSettled: () => revalidate(),
  })

  // Same sequencing as runOptimisticMutation (apply, toast, call, rollback and
  // error toast) with the request tracked by a mutation.
  const runWrite = useCallback(
    <TSnapshot, TResult = void>(config: OptimisticMutationConfig<TSnapshot, TResult>) => {
      const snapshot = config.apply()
      if (config.toast?.success) {
        toast.success(config.toast.success)
      } else if (config.toast?.info) {
        toast.info(config.toast.info)
      }
      let request: Promise<TResult>
      try {
        request = config.call()
      } catch (err) {
        request = Promise.reject(err)
      }
      // The mutation owns the rejection; this only avoids a transient
      // unhandled-rejection report before it subscribes.
      request.catch(() => undefined)
      trackWrite({
        request,
        onSuccess: config.onSuccess as ((result: unknown) => void) | undefined,
        onFailure: (err) => {
          if (config.skipRollbackIfError?.(err)) return
          if (config.warnMessage) warn(config.warnMessage, err)
          config.rollback(snapshot)
          if (config.toast?.error) toast.error(config.toast.error)
        },
      })
    },
    [trackWrite]
  )

  const updateStoreConfig = useCallback(
    (newConfig: Partial<StorefrontConfig>) => {
      const restaurantId = activeRestaurant?.id
      void runOptimisticMutation({
        apply: () => {
          const previousConfig = activeRestaurant?.config
          updateActiveRestaurantRecord((current) => ({
            ...current,
            config: { ...current.config, ...newConfig },
          }))
          return previousConfig
        },
        call: () =>
          restaurantId ? apiClient.updateRestaurant(restaurantId, splitConfigForApi(newConfig)) : Promise.resolve(undefined),
        rollback: (previousConfig) => {
          if (!previousConfig) return
          updateActiveRestaurantRecord((current) => ({ ...current, config: previousConfig }))
        },
        toast: {
          success: "Diseño y configuración actualizados",
          error: "Error al guardar la configuración en el servidor",
        },
        warnMessage: "Could not persist store config to backend API:",
      })
    },
    [activeRestaurant?.id, activeRestaurant?.config, updateActiveRestaurantRecord]
  )

  const resetStoreConfig = useCallback(() => {
    const restaurantId = activeRestaurant?.id
    void runOptimisticMutation({
      apply: () => {
        const previousConfig = activeRestaurant?.config
        updateActiveRestaurantRecord((current) => ({
          ...current,
          config: {
            ...DEFAULT_STORE_CONFIG,
            // Resetting the design never touches the opening hours or the pause.
            schedule: current.config.schedule,
            timezone: current.config.timezone,
            ordersPaused: current.config.ordersPaused,
          },
        }))
        return previousConfig
      },
      call: () =>
        restaurantId
          ? apiClient.updateRestaurant(restaurantId, { config: splitConfigForApi(DEFAULT_STORE_CONFIG).config })
          : Promise.resolve(undefined),
      rollback: (previousConfig) => {
        if (!previousConfig) return
        updateActiveRestaurantRecord((current) => ({ ...current, config: previousConfig }))
      },
      toast: { info: "Diseño restablecido a los valores por defecto", error: "Error al restablecer la configuración en el servidor" },
      warnMessage: "Could not persist reset store config to backend API:",
    })
  }, [activeRestaurant?.id, activeRestaurant?.config, updateActiveRestaurantRecord])

  const addProduct = useCallback(
    (item: Omit<MenuItem, "id">) => {
      const tempId = nextTempId("prod")
      const newItem: MenuItem = { ...item, id: tempId }

      runWrite({
        apply: () => {
          updateActiveRestaurantRecord((current) => ({
            ...current,
            products: [newItem, ...current.products],
          }))
        },
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
        onSuccess: (created) => {
          updateActiveRestaurantRecord((current) => ({
            ...current,
            products: current.products.map((p) => (p.id === tempId ? created : p)),
          }))
        },
        rollback: () => {
          updateActiveRestaurantRecord((current) => ({
            ...current,
            products: current.products.filter((p) => p.id !== tempId),
          }))
        },
        toast: { success: `"${item.name}" agregado al menú`, error: "Error al guardar producto en el servidor" },
        warnMessage: "Could not persist product to backend API:",
      })
    },
    [activeRestaurant.id, updateActiveRestaurantRecord, runWrite]
  )

  const updateProduct = useCallback(
    (id: string, updates: Partial<MenuItem>) => {
      // `previousProducts` is captured as a side effect inside the updater
      // passed to updateActiveRestaurantRecord, which React only invokes when
      // it next flushes — not synchronously. rollback() runs later (after the
      // awaited call rejects), by which point the flush has happened and this
      // closure read is correct; reading it from apply()'s return value would
      // not be.
      let previousProducts: MenuItem[] = []
      runWrite({
        apply: () => {
          updateActiveRestaurantRecord((current) => {
            previousProducts = current.products
            return {
              ...current,
              products: current.products.map((p) => (p.id === id ? { ...p, ...updates } : p)),
            }
          })
        },
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
        rollback: () => {
          updateActiveRestaurantRecord((current) => ({ ...current, products: previousProducts }))
        },
        toast: { success: "Producto actualizado", error: "Error al actualizar producto en el servidor" },
        warnMessage: "Could not update product in backend API:",
      })
    },
    [activeRestaurant.id, updateActiveRestaurantRecord, runWrite]
  )

  const deleteProduct = useCallback(
    (id: string) => {
      let previousProducts: MenuItem[] = []
      runWrite({
        apply: () => {
          updateActiveRestaurantRecord((current) => {
            previousProducts = current.products
            return { ...current, products: current.products.filter((p) => p.id !== id) }
          })
        },
        call: () => apiClient.deleteProduct(id, activeRestaurant.id),
        rollback: () => {
          updateActiveRestaurantRecord((current) => ({ ...current, products: previousProducts }))
        },
        toast: { success: "Producto eliminado del menú", error: "Error al eliminar producto del servidor" },
        skipRollbackIfError: isNotFoundError,
        warnMessage: "Could not delete product from backend API:",
      })
    },
    [activeRestaurant.id, updateActiveRestaurantRecord, runWrite]
  )

  const toggleProductStock = useCallback(
    (id: string) => {
      const target = activeRestaurant.products.find((p) => p.id === id)
      if (!target) return
      // Computed from current state OUTSIDE any updater (updaters must be pure).
      const isNowInStock = !target.inStock

      runWrite({
        apply: () => {
          updateActiveRestaurantRecord((current) => ({
            ...current,
            products: current.products.map((p) => (p.id === id ? { ...p, inStock: isNowInStock } : p)),
          }))
        },
        call: () => apiClient.updateProduct(id, { isAvailable: isNowInStock }, activeRestaurant.id),
        rollback: () => {
          // Roll back only this product's availability, from current state.
          updateActiveRestaurantRecord((current) => ({
            ...current,
            products: current.products.map((p) => (p.id === id ? { ...p, inStock: !isNowInStock } : p)),
          }))
        },
        toast: {
          info: `Producto marcado como ${isNowInStock ? "Disponible" : "Agotado"}`,
          error: "Error al actualizar disponibilidad en el servidor",
        },
        warnMessage: "Could not update product availability in backend API:",
      })
    },
    [activeRestaurant.id, activeRestaurant.products, updateActiveRestaurantRecord, runWrite]
  )

  const addAddition = useCallback(
    (item: Omit<AdditionItem, "id">) => {
      const tempId = nextTempId("add")
      const newItem: AdditionItem = { ...item, id: tempId }
      const targetRestId = activeRestaurant?.id

      runWrite({
        apply: () => {
          updateActiveRestaurantRecord((current) => ({
            ...current,
            additions: [...current.additions, newItem],
          }))
        },
        call: () =>
          apiClient.createAddition({
            name: item.name,
            price: item.price,
            isAvailable: item.available,
            restaurantId: targetRestId,
          }),
        onSuccess: (created) => {
          updateActiveRestaurantRecord((current) => ({
            ...current,
            additions: current.additions.map((a) => (a.id === tempId ? created : a)),
          }))
        },
        rollback: () => {
          updateActiveRestaurantRecord((current) => ({
            ...current,
            additions: current.additions.filter((a) => a.id !== tempId),
          }))
        },
        toast: { success: `Adicional "${item.name}" creado`, error: "Error al guardar adicional en el servidor" },
        warnMessage: "Could not persist addition to backend API:",
      })
    },
    [activeRestaurant?.id, updateActiveRestaurantRecord, runWrite]
  )

  const updateAddition = useCallback(
    (id: string, updates: Partial<AdditionItem>) => {
      const targetRestId = activeRestaurant?.id
      let previousAdditions: AdditionItem[] = []

      runWrite({
        apply: () => {
          updateActiveRestaurantRecord((current) => {
            previousAdditions = current.additions
            return {
              ...current,
              additions: current.additions.map((a) => (a.id === id ? { ...a, ...updates } : a)),
            }
          })
        },
        call: () =>
          apiClient.updateAddition(id, {
            name: updates.name,
            price: updates.price,
            isAvailable: updates.available,
            restaurantId: targetRestId,
          }),
        rollback: () => {
          updateActiveRestaurantRecord((current) => ({ ...current, additions: previousAdditions }))
        },
        toast: { success: "Adicional actualizado", error: "Error al actualizar adicional en el servidor" },
        warnMessage: "Could not update addition in backend API:",
      })
    },
    [activeRestaurant?.id, updateActiveRestaurantRecord, runWrite]
  )

  const deleteAddition = useCallback(
    (id: string) => {
      const targetRestId = activeRestaurant?.id
      let previousAdditions: AdditionItem[] = []

      runWrite({
        apply: () => {
          updateActiveRestaurantRecord((current) => {
            previousAdditions = current.additions
            return { ...current, additions: current.additions.filter((a) => a.id !== id) }
          })
        },
        call: () => apiClient.deleteAddition(id, targetRestId),
        rollback: () => {
          updateActiveRestaurantRecord((current) => ({ ...current, additions: previousAdditions }))
        },
        toast: { success: "Adicional eliminado", error: "Error al eliminar adicional del servidor" },
        skipRollbackIfError: isNotFoundError,
        warnMessage: "Could not delete addition from backend API:",
      })
    },
    [activeRestaurant?.id, updateActiveRestaurantRecord, runWrite]
  )

  // The category list is the UNION of owner-created categories and the
  // categories present on products, deduplicated. This is the exact set the
  // modal, the filter (useMenuFilter) and deleteCategory's guard all see, so
  // they can never disagree. It may legitimately be empty (a restaurant with
  // zero categories): no default is fabricated here.
  const categories = useMemo(() => {
    const stored = activeRestaurant.categories || []
    const fromProducts = activeRestaurant.products.map((p) => p.category).filter(Boolean)
    return Array.from(new Set([...stored, ...fromProducts]))
  }, [activeRestaurant.categories, activeRestaurant.products])

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
        apply: () => {
          updateActiveRestaurantRecord((current) => ({ ...current, categories: nextCategories }))
        },
        call: () => apiClient.updateCategories(nextCategories, activeRestaurant.slug || activeRestaurant.id),
        rollback: () => {
          updateActiveRestaurantRecord((current) => ({ ...current, categories: previousCategories }))
        },
        toast: { success: `Categoría "${trimmed}" creada`, error: "Error al guardar categoría en el servidor" },
        warnMessage: "Could not sync categories to backend API:",
      })
    },
    [categories, activeRestaurant.slug, activeRestaurant.id, updateActiveRestaurantRecord, runWrite]
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
      const previousProducts = activeRestaurant.products || []

      const nextCategories = categories.map((c) => (c.toLowerCase() === oldName.toLowerCase() ? trimmedNew : c))
      const nextProducts = previousProducts.map((p) =>
        p.category?.toLowerCase() === oldName.toLowerCase() ? { ...p, category: trimmedNew } : p
      )

      runWrite({
        apply: () => {
          updateActiveRestaurantRecord((current) => ({
            ...current,
            categories: nextCategories,
            products: nextProducts,
          }))
        },
        // Single server operation: the backend renames the category row in
        // place, so its products keep their category (no per-product updates).
        call: () =>
          apiClient.updateCategories(nextCategories, activeRestaurant.slug || activeRestaurant.id, [
            { from: oldName, to: trimmedNew },
          ]),
        rollback: () => {
          updateActiveRestaurantRecord((current) => ({
            ...current,
            categories: previousCategories,
            products: previousProducts,
          }))
        },
        toast: { success: `Categoría renombrada a "${trimmedNew}"`, error: "Error al renombrar categoría en el servidor" },
        warnMessage: "Could not sync categories to backend API:",
      })
    },
    [categories, activeRestaurant.products, activeRestaurant.slug, activeRestaurant.id, updateActiveRestaurantRecord, runWrite]
  )

  const deleteCategory = useCallback(
    (categoryName: string) => {
      // Rule (ii): the LAST category cannot be deleted while it still has
      // products assigned. If it has none, deletion is allowed and the list
      // may become empty. The guard validates the SAME union list the UI shows.
      const hasProducts = activeRestaurant.products.some((p) => p.category === categoryName)
      if (categories.length <= 1 && hasProducts) {
        toast.error(
          "No se puede eliminar la última categoría porque tiene productos asignados. Mové o eliminá esos productos primero."
        )
        return
      }
      const previousCategories = categories
      const previousProducts = activeRestaurant.products || []

      const nextCategories = categories.filter((c) => c !== categoryName)
      // No fabricated fallback: only reassign products when a target exists.
      const fallback = nextCategories[0]
      const nextProducts = fallback
        ? previousProducts.map((p) =>
            p.category === categoryName ? { ...p, category: fallback } : p
          )
        : previousProducts

      runWrite({
        apply: () => {
          updateActiveRestaurantRecord((current) => ({
            ...current,
            categories: nextCategories,
            products: nextProducts,
          }))
        },
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
        rollback: () => {
          updateActiveRestaurantRecord((current) => ({
            ...current,
            categories: previousCategories,
            products: previousProducts,
          }))
        },
        toast: { success: `Categoría "${categoryName}" eliminada`, error: "Error al eliminar categoría del servidor" },
        warnMessage: "Could not sync categories to backend API:",
      })
    },
    [categories, activeRestaurant.products, activeRestaurant.slug, activeRestaurant.id, updateActiveRestaurantRecord, runWrite]
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
      products: activeRestaurant.products,
      addProduct,
      updateProduct,
      deleteProduct,
      toggleProductStock,
      additions: activeRestaurant.additions,
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
      activeRestaurant.products,
      addProduct,
      updateProduct,
      deleteProduct,
      toggleProductStock,
      activeRestaurant.additions,
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
