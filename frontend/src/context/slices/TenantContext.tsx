import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react"
import {
  QueryClientContext,
  QueryClientProvider,
  hashKey,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import type { RestaurantRecord } from "@/types/restaurant"
import { DEFAULT_STORE_CONFIG } from "@/constants/themePresets"
import {
  TenantRepository,
  defaultTenantRepository,
} from "@/core/storage/TenantRepository"
import { apiClient, isNotFoundError } from "@/core/api/apiClient"
import { useAuth } from "./AuthContext"
import { splitConfigForApi, scheduleFieldsFromApi } from "@/lib/storeSchedule"
import { toast } from "sonner"
import { runOptimisticMutation } from "./optimisticMutation"
import { nextTempId } from "@/lib/ids"
import { ADMIN_ROOT_PATHS } from "@/core/router/adminRootPaths"
import { appQueryClient } from "@/core/query/queryClient"
import { keys, keyPrefixes } from "@/core/query/keys"
import { takeDeferredRead } from "@/core/query/deferredReads"
import { restorePersistedQueries } from "@/core/query/persistence"
import {
  addToDirectory,
  forgetRestaurant,
  knownRestaurants,
  resolveRestaurant,
  useResolvedRestaurant,
  patchRestaurant,
  restoreRestaurant,
  seedRestaurant,
  snapshotRestaurant,
  useKnownRestaurants,
} from "./restaurantCache"
import {
  restaurantsQueryOptions,
  restaurantQueryOptions,
  restaurantStatusQueryOptions,
  TENANT_WRITES_KEY,
} from "@/core/query/options"

export type LoadRestaurantOutcome = "ok" | "not-found" | "error"

export interface TenantContextType {
  restaurants: RestaurantRecord[]
  activeRestaurant: RestaurantRecord
  /**
   * Session-aware tenant id (A1/A2): session.restaurantId when the session is
   * a restaurant admin, else the raw persisted activeRestaurantId. Data
   * providers key fetches/SSE/mutations on this value so a stale persisted
   * active restaurant can never emit cross-tenant traffic on first render.
   */
  effectiveRestaurantId: string
  activeRestaurantId: string
  activeRestaurantSlug: string
  isSyncing: boolean
  switchRestaurant: (idOrSlug: string) => void
  /**
   * Resolve a tenant by id/slug (known locally or fetched once from the
   * backend), register it and make it active. Never falls back to another
   * tenant: on failure the active tenant is untouched and the outcome tells
   * the caller to show a not-found or a retryable error state.
   */
  loadRestaurant: (idOrSlug: string) => Promise<LoadRestaurantOutcome>
  createRestaurant: (data: {
    name: string
    slug: string
    tagline: string
    whatsappNumber: string
    adminPassword?: string
    adminUsername?: string
    primaryColor?: string
    templateType?: "burger" | "pizza" | "tacos" | "blank"
  }) => RestaurantRecord | undefined
  updateRestaurant: (id: string, updates: Partial<RestaurantRecord>) => Promise<void>
  deleteRestaurant: (id: string) => Promise<void>
  refreshRestaurants: () => Promise<void>
  /** Storefront polling: refresh schedule, timezone and pause from the public endpoint (silent on failure). */
  refreshStoreStatus: () => Promise<void>
}

const TenantContext = createContext<TenantContextType | undefined>(undefined)

interface TenantProviderProps {
  children: React.ReactNode
  repository?: TenantRepository
}

/**
 * TenantContext owns the tenant selection (the persisted active restaurant id
 * and the effective-tenant rule). Restaurant records are server state in the
 * query cache (directory and per-restaurant entries); the only tenant data
 * persisted is the active id and the public storefront cache. The composed
 * RestaurantProvider mounts it inside its QueryClientProvider; when it is
 * mounted on its own (isolated slice usage) it falls back to the shared app
 * client so the provider order can never break it.
 */
export const TenantProvider: React.FC<TenantProviderProps> = (props) => {
  const hasClient = useContext(QueryClientContext) !== undefined
  const inner = <TenantProviderInner {...props} />
  return hasClient ? inner : <QueryClientProvider client={appQueryClient}>{inner}</QueryClientProvider>
}

/** Placeholder while no tenant is active (never fetched, never written). */
const NO_RESTAURANT: RestaurantRecord = {
  id: "rest-default",
  slug: "default",
  isActive: true,
  createdAt: new Date(0).toISOString(),
  config: DEFAULT_STORE_CONFIG,
}

/** First path segment of the current URL ("" on "/" or without a window). */
function currentFirstSegment(): string {
  try {
    return typeof window !== "undefined"
      ? window.location.pathname.replace(/^\/+|\/+$/g, "").toLowerCase().split("/")[0]
      : ""
  } catch {
    return ""
  }
}

const TenantProviderInner: React.FC<TenantProviderProps> = ({
  children,
  repository = defaultTenantRepository,
}) => {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const role = session.role

  // The public storefront cache persisted for offline reloads is restored
  // before anything below reads the cache (synchronous storage), after the
  // envelope persisted by older versions is migrated into it.
  useState(() => {
    // Restaurant records ARE the tenant context: a looked-up or restored entry
    // usually has no observer, and must not be garbage-collected from under
    // the active tenant (logout still clears the whole client).
    queryClient.setQueryDefaults(keyPrefixes.restaurant(), { gcTime: Infinity })
    queryClient.setQueryDefaults(keyPrefixes.restaurants(), { gcTime: Infinity })
    repository.migrateLegacyEnvelope()
    restorePersistedQueries(queryClient)
  })

  const restaurants = useKnownRestaurants(queryClient, role)

  const [activeRestaurantId, setActiveRestaurantId] = useState<string>(() => {
    // No fabricated default tenant: an absent saved id stays empty until a
    // real tenant is selected (slug route, session or switcher).
    const saved = repository.getActiveRestaurantId("")
    if (!saved) return ""
    const record = resolveRestaurant(queryClient, role, saved)
    const firstSegment = currentFirstSegment()
    const isPublicSlugRoute = firstSegment !== "" && !ADMIN_ROOT_PATHS.includes(firstSegment)
    if (!record) {
      // An admin's saved tenant is confirmed by the directory read (cleared
      // below if it is not there); anyone else needs a known record.
      return !isPublicSlugRoute && apiClient.hasToken() ? saved : ""
    }
    // On a public storefront URL (anything other than "/" or the admin roots
    // in ADMIN_ROOT_PATHS), a tenant persisted from a previous visit must only
    // be kept when it matches this URL's slug: otherwise a stale tenant would
    // render as the storefront for an instant before route resolution
    // corrects an unrelated/invalid slug to the not-found screen.
    if (isPublicSlugRoute && firstSegment !== record.slug.toLowerCase() && firstSegment !== record.id.toLowerCase()) {
      return ""
    }
    return record.id
  })

  // The platform directory is private (admin-only): anonymous visitors
  // (landing, storefront, not-found, checkout) never request it; their tenant
  // comes from the public by-slug lookup. The role is part of the key, so the
  // directory is never served across sessions. Every mount (login, tenant
  // admin reload) asks the server again.
  const directoryQuery = useQuery({
    ...restaurantsQueryOptions(role),
    enabled: apiClient.hasToken() && !session.mustChangePassword,
    staleTime: 0,
  })
  const isSyncing = directoryQuery.isFetching

  const refreshRestaurants = useCallback(async () => {
    if (!apiClient.hasToken()) return
    try {
      // staleTime 0: an explicit refresh always asks the server (concurrent
      // refreshes share the in-flight request).
      await queryClient.fetchQuery({ ...restaurantsQueryOptions(role), staleTime: 0 })
      // The directory changed (a restaurant was created, say): so did the platform totals.
      void queryClient.invalidateQueries({ queryKey: keyPrefixes.platformStats() })
    } catch (err) {
      if (import.meta.env?.MODE !== "test") {
        console.warn("Could not sync restaurants from backend API:", err)
      }
    }
  }, [queryClient, role])

  // Public by-slug/id lookup shared by route resolution and the switcher
  // fallback: concurrent lookups of the same tenant share one request and a
  // fresh result is reused briefly. Failures are never cached. The record is
  // also registered under its id, which is what the active tenant is keyed by.
  const fetchTenant = useCallback(
    async (idOrSlug: string): Promise<RestaurantRecord | null> => {
      const record = await queryClient.fetchQuery(restaurantQueryOptions(role, idOrSlug))
      if (record) seedRestaurant(queryClient, role, record)
      return record
    },
    [queryClient, role]
  )

  // Writes keep the optimistic apply/rollback of runOptimisticMutation; the
  // already-dispatched request is tracked by a mutation (networkMode "always").
  const { mutateAsync: trackWrite } = useMutation({
    mutationKey: TENANT_WRITES_KEY,
    mutationFn: (request: Promise<unknown>) => request,
  })

  // Every tenant write (restaurant edits here, store config in the catalog
  // slice) settles through this listener: cached lookups predate the write,
  // and once the last one settles a directory read deferred during the writes
  // is pulled again.
  useEffect(() => {
    const writesHash = hashKey(TENANT_WRITES_KEY)
    return queryClient.getMutationCache().subscribe((event) => {
      if (event.type !== "updated") return
      if (event.action.type !== "success" && event.action.type !== "error") return
      const key = event.mutation.options.mutationKey
      if (!key || hashKey(key) !== writesHash) return
      void queryClient.invalidateQueries({ queryKey: keyPrefixes.restaurant() })
      void queryClient.invalidateQueries({ queryKey: keyPrefixes.restaurantStatus() })
      // Pausing, editing or deleting a restaurant moves the platform totals.
      void queryClient.invalidateQueries({ queryKey: keyPrefixes.platformStats() })
      if (queryClient.isMutating({ mutationKey: TENANT_WRITES_KEY }) > 0) return
      if (takeDeferredRead(queryClient, keys.restaurants(role))) {
        void queryClient.invalidateQueries({ queryKey: keys.restaurants(role) })
      }
    })
  }, [queryClient, role])

  const dispatchWrite = useCallback(
    <T,>(request: Promise<T>): Promise<T> => {
      // The mutation owns the rejection; this only avoids a transient
      // unhandled-rejection report before it subscribes.
      request.catch(() => undefined)
      return trackWrite(request) as Promise<T>
    },
    [trackWrite]
  )

  // A1/A2: a restaurant-bound session owns its tenant — the effective tenant
  // is ALWAYS session.restaurantId, so a stale persisted activeRestaurant can
  // never win on render and every data provider keys on this value. Guests and
  // super admins keep the raw persisted activeRestaurantId (storefront switcher
  // and super-tenant navigation still work unchanged).
  const effectiveRestaurantId =
    session.role === "restaurant" && session.restaurantId
      ? session.restaurantId
      : activeRestaurantId

  // An admin's saved tenant that the directory does not list is dropped.
  const directoryLoaded = directoryQuery.data !== undefined
  useEffect(() => {
    if (!directoryLoaded || !activeRestaurantId) return
    if (!resolveRestaurant(queryClient, role, activeRestaurantId)) setActiveRestaurantId("")
  }, [directoryLoaded, activeRestaurantId, queryClient, role, restaurants])

  useEffect(() => {
    repository.setActiveRestaurantId(activeRestaurantId)
  }, [activeRestaurantId, repository])

  // The active restaurant (and its store config) is read from its
  // keys.restaurant entry; the placeholder only stands in while none is known.
  const activeRestaurant = useResolvedRestaurant(queryClient, role, effectiveRestaurantId) ?? NO_RESTAURANT

  // Storefront-only refresh of the schedule, timezone and pause flag from the
  // public by-slug endpoint, so customers on other devices see a pause or a new
  // schedule without reloading. Merges ONLY those fields (cart, catalog and the
  // rest of the config are untouched), leaves the cache untouched when nothing
  // changed (no re-render), and is silent on failure so the last known data
  // keeps working.
  const refreshStoreStatus = useCallback(async (): Promise<void> => {
    const current = resolveRestaurant(queryClient, role, effectiveRestaurantId)
    if (!current?.slug) return
    try {
      const fetched: any = await queryClient.fetchQuery({
        ...restaurantStatusQueryOptions(role, current.slug),
        staleTime: 0,
      })
      if (!fetched || fetched.id !== current.id) return
      const next = scheduleFieldsFromApi(fetched as any)
      const cfg = current.config
      if (
        JSON.stringify(cfg.schedule) === JSON.stringify(next.schedule) &&
        cfg.timezone === next.timezone &&
        Boolean(cfg.ordersPaused) === next.ordersPaused
      ) {
        return
      }
      patchRestaurant(queryClient, role, current.id, (r) => ({ ...r, config: { ...r.config, ...next } }))
    } catch {
      // Silent: keep the last known schedule.
    }
  }, [effectiveRestaurantId, queryClient, role])

  const switchRestaurant = useCallback(
    (idOrSlug: string) => {
      if (!idOrSlug) {
        setActiveRestaurantId("")
        return
      }
      const target = resolveRestaurant(queryClient, role, idOrSlug)
      // M5: a restaurant admin must never live-switch the active tenant (neither
      // by direct /slug navigation nor via the fetch fallback below). Only their
      // own session-bound restaurant is allowed; guests (storefront/landing) and
      // super admins keep the full switcher behavior.
      // The own tenant may not be known yet (first visit, list still in
      // flight): that is NOT a foreign request. It is fetched below and only a
      // record that resolves to ANOTHER tenant warns.
      const ownId = session.role === "restaurant" ? session.restaurantId : undefined
      if (ownId && target && target.id !== ownId) {
        toast.warning("Solo podés operar tu propio restaurante")
        return
      }
      if (target) {
        setActiveRestaurantId(target.id)
        return
      }
      fetchTenant(idOrSlug)
        .then((fetched) => {
          if (fetched && fetched.id) {
            if (ownId && fetched.id !== ownId) {
              forgetRestaurant(queryClient, role, fetched, idOrSlug)
              toast.warning("Solo podés operar tu propio restaurante")
              return
            }
            setActiveRestaurantId(fetched.id)
          }
        })
        .catch((err) => {
          if (import.meta.env?.MODE !== "test") {
            console.warn("Could not load restaurant from backend API:", err)
          }
          toast.error("No se pudo cargar el restaurante. Intentá de nuevo.")
        })
    },
    [queryClient, role, session.role, session.restaurantId, fetchTenant]
  )

  const loadRestaurant = useCallback(
    async (idOrSlug: string): Promise<LoadRestaurantOutcome> => {
      const known = resolveRestaurant(queryClient, role, idOrSlug)
      if (known) {
        switchRestaurant(known.id)
        return "ok"
      }
      try {
        const fetched = await fetchTenant(idOrSlug)
        if (!fetched || !fetched.id) return "not-found"
        // Same guard as switchRestaurant: a restaurant admin never live-switches.
        if (session.role === "restaurant" && session.restaurantId !== fetched.id) {
          forgetRestaurant(queryClient, role, fetched, idOrSlug)
          toast.warning("Solo podés operar tu propio restaurante")
          return "ok"
        }
        setActiveRestaurantId(fetched.id)
        return "ok"
      } catch (err) {
        if (isNotFoundError(err)) return "not-found"
        if (import.meta.env?.MODE !== "test") {
          console.warn("Could not load restaurant from backend API:", err)
        }
        return "error"
      }
    },
    [queryClient, role, session.role, session.restaurantId, switchRestaurant, fetchTenant]
  )

  const createRestaurant = useCallback(
    (data: {
      name: string
      slug: string
      tagline: string
      whatsappNumber: string
      adminPassword?: string
      adminUsername?: string
      primaryColor?: string
      templateType?: "burger" | "pizza" | "tacos" | "blank"
    }) => {
      const cleanSlug = data.slug
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")

      // M9: reject duplicate slugs client-side before any write. A slug is the
      // public storefront URL key — two tenants sharing it would make mutations
      // and lookups ambiguous.
      if (knownRestaurants(queryClient, role).some((r) => r.slug === cleanSlug)) {
        toast.error("Ya existe un restaurante con ese slug")
        return undefined
      }

      const newRecord: RestaurantRecord = {
        id: nextTempId("rest"),
        slug: cleanSlug || `rest-${Date.now().toString(36)}`,
        isActive: true,
        createdAt: new Date().toISOString(),
        config: {
          ...DEFAULT_STORE_CONFIG,
          name: data.name,
          tagline: data.tagline || DEFAULT_STORE_CONFIG.tagline,
          whatsappNumber: data.whatsappNumber,
          primaryColor: data.primaryColor || DEFAULT_STORE_CONFIG.primaryColor,
        },
        categories: [],
      }

      addToDirectory(queryClient, role, newRecord)
      setActiveRestaurantId(newRecord.id)

      apiClient
        .createRestaurant({
          id: newRecord.id,
          name: data.name,
          slug: newRecord.slug,
          tagline: data.tagline,
          whatsappNumber: data.whatsappNumber,
          adminUsername: data.adminUsername,
          adminPassword: data.adminPassword,
          primaryColor: data.primaryColor,
          templateType: data.templateType,
          categories: [],
          config: newRecord.config,
        })
        .then(async (created) => {
          if (created && created.id) {
            // SUS-02: the backend provisions the admin user and returns the
            // one-time credentials in the 201 create response. SUS-20: those
            // credentials are surfaced exactly once via the toast below and
            // must NEVER enter a cached record; only the harmless
            // adminUsername metadata stays.
            const createdCreds = created as { adminUsername?: string; adminPassword?: string }
            const credentials =
              createdCreds.adminUsername && createdCreds.adminPassword
                ? { adminUsername: createdCreds.adminUsername, adminPassword: createdCreds.adminPassword }
                : undefined
            const { adminPassword: _oneTimeSecret, ...safeCreated } = created
            patchRestaurant(queryClient, role, newRecord.id, (r) => ({ ...r, ...safeCreated, id: created.id }))
            if (credentials) {
              toast.success("Restaurante creado con éxito", {
                description: `Usuario: ${credentials.adminUsername} — Clave: ${credentials.adminPassword}`,
              })
            }
          }
          await refreshRestaurants()
        })
        .catch((err) => {
          if (import.meta.env?.MODE !== "test") {
            console.warn("Could not persist restaurant to backend API:", err)
          }
        })

      toast.success(`Restaurante "${data.name}" creado exitosamente`)
      return newRecord
    },
    [queryClient, role, refreshRestaurants]
  )

  const updateRestaurant = useCallback(
    async (id: string, updates: Partial<RestaurantRecord>) => {
      const target = resolveRestaurant(queryClient, role, id)
      const targetId = target?.id || id
      const snapshot = snapshotRestaurant(queryClient, role, targetId)

      await runOptimisticMutation({
        apply: () => patchRestaurant(queryClient, role, targetId, (r) => ({ ...r, ...updates })),
        call: () =>
          dispatchWrite(apiClient.updateRestaurant(targetId, {
            name: updates.config?.name || target?.config?.name,
            slug: updates.slug || target?.slug,
            tagline: updates.config?.tagline || target?.config?.tagline,
            whatsappNumber: updates.config?.whatsappNumber || target?.config?.whatsappNumber,
            primaryColor: updates.config?.primaryColor || target?.config?.primaryColor,
            theme: updates.config?.bgTheme || target?.config?.bgTheme,
            isActive: updates.isActive,
            ...(updates.config
              ? splitConfigForApi(updates.config)
              : { config: splitConfigForApi(target?.config ?? {}).config }),
            categories: updates.categories || target?.categories,
          })),
        rollback: () => restoreRestaurant(queryClient, role, snapshot),
        toast: {
          success:
            updates.isActive !== undefined
              ? updates.isActive
                ? "Restaurante activado"
                : "Restaurante pausado temporalmente"
              : "Restaurante actualizado correctamente",
          error: "No se pudo actualizar el restaurante en el servidor. Cambios revertidos.",
        },
        warnMessage: "Could not update restaurant on backend API, rolling back:",
      })
    },
    [queryClient, role, dispatchWrite]
  )

  const deleteRestaurant = useCallback(
    async (id: string) => {
      const targetId = resolveRestaurant(queryClient, role, id)?.id || id
      const snapshot = snapshotRestaurant(queryClient, role, targetId)

      await runOptimisticMutation({
        apply: () => patchRestaurant(queryClient, role, targetId, (r) => ({ ...r, isActive: false })),
        call: () => dispatchWrite(apiClient.deleteRestaurant(id)),
        rollback: () => restoreRestaurant(queryClient, role, snapshot),
        toast: {
          success: "Restaurante eliminado correctamente",
          error: "No se pudo desactivar el restaurante en el servidor. Cambios revertidos.",
        },
        skipRollbackIfError: isNotFoundError,
        warnMessage: "Could not soft delete restaurant from backend API, rolling back:",
      })
    },
    [queryClient, role, dispatchWrite]
  )

  const value: TenantContextType = useMemo(
    () => ({
      restaurants,
      activeRestaurant,
      effectiveRestaurantId,
      activeRestaurantId: activeRestaurant.id,
      activeRestaurantSlug: activeRestaurant.slug,
      isSyncing,
      switchRestaurant,
      loadRestaurant,
      createRestaurant,
      updateRestaurant,
      deleteRestaurant,
      refreshRestaurants,
      refreshStoreStatus,
    }),
    [
      restaurants,
      activeRestaurant,
      effectiveRestaurantId,
      isSyncing,
      switchRestaurant,
      loadRestaurant,
      createRestaurant,
      updateRestaurant,
      deleteRestaurant,
      refreshRestaurants,
      refreshStoreStatus,
    ]
  )

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

export const useTenant = (): TenantContextType => {
  const context = useContext(TenantContext)
  if (!context) {
    throw new Error("useTenant must be used within a TenantProvider")
  }
  return context
}
