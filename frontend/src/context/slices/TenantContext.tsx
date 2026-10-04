import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from "react"
import {
  QueryClientContext,
  QueryClientProvider,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import type {
  RestaurantRecord,
  StorefrontConfig,
  StorageEnvelopeV2,
} from "@/types/restaurant"
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
import { keyPrefixes } from "@/core/query/keys"
import {
  restaurantsQueryOptions,
  restaurantQueryOptions,
  restaurantStatusQueryOptions,
} from "@/core/query/options"

export type LoadRestaurantOutcome = "ok" | "not-found" | "error"

/** Merges the public/admin payload into a storefront config: schedule fields come from the top level, the legacy text is dropped. */
function configFromApi(fetched: any, base: StorefrontConfig): StorefrontConfig {
  const { openingHours: _legacyText, ...config } = (fetched.config || {}) as Record<string, unknown>
  return { ...base, ...config, ...scheduleFieldsFromApi({ ...base, ...fetched }) } as StorefrontConfig
}

function toRestaurantRecord(fetched: any): RestaurantRecord {
  return {
    id: fetched.id,
    slug: fetched.slug,
    isActive: fetched.isActive !== undefined ? Boolean(fetched.isActive) : true,
    createdAt: fetched.createdAt || new Date().toISOString(),
    categories: fetched.categories || [],
    config: {
      ...configFromApi(fetched, DEFAULT_STORE_CONFIG),
      name: fetched.name || fetched.config?.name || DEFAULT_STORE_CONFIG.name,
    },
    products: fetched.products || [],
    additions: fetched.additions || [],
  }
}

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
  superAdminPassword?: string
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
  updateActiveRestaurantRecord: (updater: (current: RestaurantRecord) => RestaurantRecord) => void
  refreshRestaurants: () => Promise<void>
  /** Storefront polling: refresh schedule, timezone and pause from the public endpoint (silent on failure). */
  refreshStoreStatus: () => Promise<void>
}

const TenantContext = createContext<TenantContextType | undefined>(undefined)

// Shared mutation key so a settling write can tell whether others are in flight.
const TENANT_WRITES_KEY = ["tenant-writes"] as const

interface TenantProviderProps {
  children: React.ReactNode
  repository?: TenantRepository
}

/**
 * TenantContext stays the persistence root (localStorage envelope, cross-tab
 * sync, effective-tenant rule); only its server calls go through TanStack
 * Query. The composed RestaurantProvider mounts it inside its
 * QueryClientProvider; when it is mounted on its own (isolated slice usage) it
 * falls back to the shared app client so the provider order can never break it.
 */
export const TenantProvider: React.FC<TenantProviderProps> = (props) => {
  const hasClient = useContext(QueryClientContext) !== undefined
  const inner = <TenantProviderInner {...props} />
  return hasClient ? inner : <QueryClientProvider client={appQueryClient}>{inner}</QueryClientProvider>
}

const TenantProviderInner: React.FC<TenantProviderProps> = ({
  children,
  repository = defaultTenantRepository,
}) => {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const role = session.role
  const [envelope, setEnvelope] = useState<StorageEnvelopeV2>(() =>
    repository.loadEnvelope()
  )
  const [isSyncing, setIsSyncing] = useState<boolean>(false)

  const [activeRestaurantId, setActiveRestaurantId] = useState<string>(() => {
    // No fabricated default tenant: an unknown/absent saved id stays empty
    // until a real tenant is selected (slug route, session or switcher).
    const saved = repository.getActiveRestaurantId("")
    const record = envelope.restaurants.find((r) => r.id === saved || r.slug === saved)
    if (!record) return ""

    // On a public storefront URL (anything other than "/" or the admin roots in ADMIN_ROOT_PATHS), a
    // tenant persisted from a previous visit in this tab must only be kept
    // when it actually matches this URL's slug. Otherwise the stale tenant
    // (e.g. a restaurant opened earlier) would render as the storefront for
    // an instant before route resolution corrects an unrelated/invalid slug
    // (like a typo) to the not-found screen.
    let firstSegment = ""
    try {
      firstSegment = typeof window !== "undefined"
        ? window.location.pathname.replace(/^\/+|\/+$/g, "").toLowerCase().split("/")[0]
        : ""
    } catch {
      firstSegment = ""
    }
    const isPublicSlugRoute = firstSegment !== "" && !ADMIN_ROOT_PATHS.includes(firstSegment)
    if (isPublicSlugRoute && firstSegment !== record.slug.toLowerCase() && firstSegment !== record.id.toLowerCase()) {
      return ""
    }

    return saved
  })

  // Merges the backend directory into the envelope. SUS-20: never re-merge the
  // one-time admin password — not from backend responses and not from legacy
  // local records; the secret must not ride along on refresh.
  const applyDirectory = useCallback(
    (backendRestaurants: any[]) => {
      setEnvelope((prev) => {
        const diskEnvelope = repository.loadEnvelope()
        const merged = backendRestaurants.map((br: any) => {
          const local =
            prev.restaurants.find((r) => r.id === br.id || r.slug === br.slug) ||
            diskEnvelope.restaurants.find((r) => r.id === br.id || r.slug === br.slug)
          const { adminPassword: _legacySecret, ...safeLocal } =
            local || ({} as Partial<RestaurantRecord>)
          return {
            ...safeLocal,
            id: br.id,
            slug: br.slug,
            isActive: br.isActive !== undefined ? Boolean(br.isActive) : true,
            createdAt: br.createdAt || local?.createdAt || new Date().toISOString(),
            // Zero categories is a valid persisted state: when the backend
            // sends a list (even []), it wins over stale local storage. Only
            // fall back to local when the backend omitted categories entirely.
            categories: Array.isArray(br.categories) ? br.categories : local?.categories ?? [],
            config: {
              ...configFromApi(br, { ...DEFAULT_STORE_CONFIG, ...(local?.config || {}) }),
              name: br.name || br.config?.name || local?.config?.name || DEFAULT_STORE_CONFIG.name,
              tagline: br.tagline || br.config?.tagline || local?.config?.tagline || DEFAULT_STORE_CONFIG.tagline,
            },
            products: local?.products || [],
            additions: local?.additions || [],
          } as RestaurantRecord
        })
        return {
          ...prev,
          restaurants: merged,
        }
      })
    },
    [repository]
  )

  // A directory response that lands while a restaurant write is in flight would
  // wipe its optimistic edit: it is dropped and the directory is pulled again
  // once the last write settles.
  const directoryDeferred = useRef(false)

  const refreshRestaurants = useCallback(async () => {
    // The platform directory is private (admin-only): anonymous visitors
    // (landing, storefront, not-found, checkout) never request it. Their
    // tenant comes from the public by-slug lookup instead.
    if (!apiClient.hasToken()) return
    setIsSyncing(true)
    try {
      // staleTime 0: an explicit refresh always asks the server (concurrent
      // refreshes share the in-flight request). The role in the key keeps the
      // cache from crossing sessions.
      const backendRestaurants = await queryClient.fetchQuery({
        ...restaurantsQueryOptions(role),
        staleTime: 0,
      })
      if (Array.isArray(backendRestaurants)) {
        if (queryClient.isMutating({ mutationKey: TENANT_WRITES_KEY }) > 0) {
          directoryDeferred.current = true
        } else {
          applyDirectory(backendRestaurants)
        }
      }
    } catch (err) {
      if (import.meta.env?.MODE !== 'test') {
        console.warn("Could not sync restaurants from backend API:", err)
      }
    } finally {
      setIsSyncing(false)
    }
  }, [queryClient, role, applyDirectory])

  // Public by-slug/id lookup shared by route resolution and the switcher
  // fallback: concurrent lookups of the same tenant share one request and a
  // fresh result is reused briefly. Failures are never cached.
  const fetchTenant = useCallback(
    (idOrSlug: string) =>
      queryClient.fetchQuery(restaurantQueryOptions(role, idOrSlug)),
    [queryClient, role]
  )

  // Writes keep the optimistic apply/rollback of runOptimisticMutation; the
  // already-dispatched request is tracked by a mutation (networkMode "always").
  const { mutateAsync: trackWrite } = useMutation({
    mutationKey: TENANT_WRITES_KEY,
    mutationFn: (request: Promise<unknown>) => request,
    onSettled: () => {
      // Cached lookups predate the write.
      void queryClient.invalidateQueries({ queryKey: keyPrefixes.restaurant() })
      void queryClient.invalidateQueries({ queryKey: keyPrefixes.restaurantStatus() })
      // The settling mutation counts itself, hence > 1.
      if (queryClient.isMutating({ mutationKey: TENANT_WRITES_KEY }) > 1) return
      if (directoryDeferred.current) {
        directoryDeferred.current = false
        void refreshRestaurants()
      }
    },
  })
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

  // Sync with Backend DB on mount and when authentication session changes
  useEffect(() => {
    if (session.mustChangePassword) return
    refreshRestaurants()
  }, [refreshRestaurants, session])

  // Storefront-only refresh of the schedule, timezone and pause flag from the
  // public by-slug endpoint, so customers on other devices see a pause or a new
  // schedule without reloading. Merges ONLY those fields (cart, catalog and the
  // rest of the config are untouched), keeps the same envelope reference when
  // nothing changed (no re-render, no localStorage write), and is silent on
  // failure so the last known data keeps working.
  const refreshStoreStatus = useCallback(async (): Promise<void> => {
    const current = envelope.restaurants.find((r) => r.id === effectiveRestaurantId)
    if (!current?.slug) return
    try {
      const fetched: any = await queryClient.fetchQuery({
        ...restaurantStatusQueryOptions(role, current.slug),
        staleTime: 0,
      })
      if (!fetched || fetched.id !== current.id) return
      const next = scheduleFieldsFromApi(fetched as any)
      setEnvelope((prev) => {
        const target = prev.restaurants.find((r) => r.id === current.id)
        if (!target) return prev
        const cfg = target.config
        if (
          JSON.stringify(cfg.schedule) === JSON.stringify(next.schedule) &&
          cfg.timezone === next.timezone &&
          Boolean(cfg.ordersPaused) === next.ordersPaused
        ) {
          return prev
        }
        return {
          ...prev,
          restaurants: prev.restaurants.map((r) =>
            r.id === current.id ? { ...r, config: { ...r.config, ...next } } : r
          ),
        }
      })
    } catch {
      // Silent: keep the last known schedule.
    }
  }, [envelope.restaurants, effectiveRestaurantId, queryClient, role])

  // Cross-tab synchronization via storage event
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "burger_page_platform_v2") {
        const updated = repository.loadEnvelope()
        setEnvelope(updated)
      }
    }
    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [repository])

  useEffect(() => {
    repository.saveEnvelope(envelope)
  }, [envelope, repository])

  useEffect(() => {
    repository.setActiveRestaurantId(activeRestaurantId)
  }, [activeRestaurantId, repository])

  const activeRestaurant = useMemo(() => {
    const found =
      envelope.restaurants.find(
        (r) => r.id === effectiveRestaurantId || r.slug === effectiveRestaurantId
      )

    return (
      found || {
        id: "rest-default",
        slug: "default",
        isActive: true,
        createdAt: new Date().toISOString(),
        config: DEFAULT_STORE_CONFIG,
        products: [],
        additions: [],
      }
    )
  }, [envelope.restaurants, effectiveRestaurantId])

  const switchRestaurant = useCallback(
    (idOrSlug: string) => {
      if (!idOrSlug) {
        setActiveRestaurantId("")
        return
      }
      const target = envelope.restaurants.find(
        (r) => r.id === idOrSlug || r.slug === idOrSlug
      )
      // M5: a restaurant admin must never live-switch the active tenant (neither
      // by direct /slug navigation nor via the fetch fallback below). Only their
      // own session-bound restaurant is allowed; guests (storefront/landing) and
      // super admins keep the full switcher behavior.
      // The own tenant may not be in the local envelope yet (first visit, cleared
      // storage, list still in flight): that is NOT a foreign request. It is
      // fetched below and only a record that resolves to ANOTHER tenant warns.
      const ownId = session.role === "restaurant" ? session.restaurantId : undefined
      if (ownId && target && target.id !== ownId) {
        toast.warning("Solo podés operar tu propio restaurante")
        return
      }
      if (target) {
        setActiveRestaurantId(target.id)
      } else {
        fetchTenant(idOrSlug)
          .then((fetched: any) => {
            if (fetched && fetched.id) {
              if (ownId && fetched.id !== ownId) {
                toast.warning("Solo podés operar tu propio restaurante")
                return
              }
              const formatted = toRestaurantRecord(fetched)
              setEnvelope((prev) =>
                prev.restaurants.some((r) => r.id === fetched.id || r.slug === fetched.slug)
                  ? prev
                  : { ...prev, restaurants: [formatted, ...prev.restaurants] }
              )
              setActiveRestaurantId(fetched.id)
            }
          })
          .catch((err) => {
            if (import.meta.env?.MODE !== "test") {
              console.warn("Could not load restaurant from backend API:", err)
            }
            toast.error("No se pudo cargar el restaurante. Intentá de nuevo.")
          })
      }
    },
    [envelope.restaurants, session.role, session.restaurantId, fetchTenant]
  )

  const loadRestaurant = useCallback(
    async (idOrSlug: string): Promise<LoadRestaurantOutcome> => {
      const lower = idOrSlug.toLowerCase()
      const known = envelope.restaurants.find(
        (r) => r.id === idOrSlug || r.slug.toLowerCase() === lower
      )
      if (known) {
        switchRestaurant(known.id)
        return "ok"
      }
      try {
        const fetched: any = await fetchTenant(idOrSlug)
        if (!fetched || !fetched.id) return "not-found"
        // Same guard as switchRestaurant: a restaurant admin never live-switches.
        if (session.role === "restaurant" && session.restaurantId !== fetched.id) {
          toast.warning("Solo podés operar tu propio restaurante")
          return "ok"
        }
        const formatted = toRestaurantRecord(fetched)
        setEnvelope((prev) =>
          prev.restaurants.some((r) => r.id === fetched.id || r.slug === fetched.slug)
            ? prev
            : { ...prev, restaurants: [formatted, ...prev.restaurants] }
        )
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
    [envelope.restaurants, session.role, session.restaurantId, switchRestaurant, fetchTenant]
  )

  const updateActiveRestaurantRecord = useCallback(
    (updater: (current: RestaurantRecord) => RestaurantRecord) => {
      setEnvelope((prev) => {
        // M10: bind the mutation to the session-aware effective tenant. When the
        // target is a stub/unknown id (e.g. the record vanished after a backend
        // refresh), create a NEW record with id targetId instead of silently
        // redirecting the write to prev.restaurants[0] (another tenant's record).
        const targetId = effectiveRestaurantId
        // No active tenant yet: there is nothing to mutate (never guess one).
        if (!targetId) return prev
        const target =
          prev.restaurants.find((r) => r.id === targetId) || {
            id: targetId,
            slug: targetId.replace(/^rest-/, ""),
            isActive: true,
            createdAt: new Date().toISOString(),
            config: DEFAULT_STORE_CONFIG,
            categories: [],
            products: [],
            additions: [],
          }

        const updated = updater(target)
        // Identity is the id ONLY — slug stays in the record as a display/business
        // key but is never an identity key for mutations (M10).
        const exists = prev.restaurants.some((r) => r.id === target.id)
        return {
          ...prev,
          restaurants: exists
            ? prev.restaurants.map((r) => (r.id === target.id ? updated : r))
            : [updated, ...prev.restaurants],
        }
      })
    },
    [effectiveRestaurantId]
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
      // and lookups ambiguous, so the envelope (and backend) must never receive
      // a second tenant with the same slug.
      if (envelope.restaurants.some((r) => r.slug === cleanSlug)) {
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
        products: [],
        additions: [],
      }

        setEnvelope((prev) => ({
          ...prev,
          restaurants: [...prev.restaurants, newRecord],
        }))

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
            // must NEVER enter the envelope record (the envelope is persisted
            // to localStorage); only the harmless adminUsername metadata stays.
            const createdCreds = created as { adminUsername?: string; adminPassword?: string }
            const credentials =
              createdCreds.adminUsername && createdCreds.adminPassword
                ? { adminUsername: createdCreds.adminUsername, adminPassword: createdCreds.adminPassword }
                : undefined
            setEnvelope((prev) => {
              const { adminPassword: _oneTimeSecret, ...safeCreated } = created
              const exists = prev.restaurants.some((r) => r.id === created.id || r.id === newRecord.id);
              if (exists) {
                return {
                  ...prev,
                  restaurants: prev.restaurants.map((r) =>
                    r.id === newRecord.id ? { ...r, ...safeCreated, id: created.id } : r
                  ),
                };
              }
              return {
                ...prev,
                restaurants: [...prev.restaurants, { ...newRecord, ...safeCreated, id: created.id }],
              };
            });
            if (credentials) {
              toast.success("Restaurante creado con éxito", {
                description: `Usuario: ${credentials.adminUsername} — Clave: ${credentials.adminPassword}`,
              })
            }
          }
          await refreshRestaurants();
        })
        .catch((err) => {
          if (import.meta.env?.MODE !== 'test') {
            console.warn("Could not persist restaurant to backend API:", err)
          }
        })

      toast.success(`Restaurante "${data.name}" creado exitosamente`)
      return newRecord
    },
    [refreshRestaurants, envelope.restaurants]
  )

  const updateRestaurant = useCallback(
    async (id: string, updates: Partial<RestaurantRecord>) => {
      const snapshot = envelope
      const target = envelope.restaurants.find((r) => r.id === id || r.slug === id)
      const targetId = target?.id || id

      await runOptimisticMutation({
        apply: () => {
          setEnvelope((prev) => ({
            ...prev,
            restaurants: prev.restaurants.map((r) =>
              r.id === id || r.slug === id ? { ...r, ...updates } : r
            ),
          }))
        },
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
        rollback: () => setEnvelope(snapshot),
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
    [envelope, dispatchWrite]
  )

  const deleteRestaurant = useCallback(
    async (id: string) => {
      const snapshot = envelope

      await runOptimisticMutation({
        apply: () => {
          setEnvelope((prev) => ({
            ...prev,
            restaurants: prev.restaurants.map((r) =>
              r.id === id || r.slug === id ? { ...r, isActive: false } : r
            ),
          }))
        },
        call: () => dispatchWrite(apiClient.deleteRestaurant(id)),
        rollback: () => setEnvelope(snapshot),
        toast: {
          success: "Restaurante eliminado correctamente",
          error: "No se pudo desactivar el restaurante en el servidor. Cambios revertidos.",
        },
        skipRollbackIfError: isNotFoundError,
        warnMessage: "Could not soft delete restaurant from backend API, rolling back:",
      })
    },
    [envelope, dispatchWrite]
  )

  const value: TenantContextType = useMemo(
    () => ({
      restaurants: envelope.restaurants,
      activeRestaurant,
      effectiveRestaurantId,
      activeRestaurantId: activeRestaurant.id,
      activeRestaurantSlug: activeRestaurant.slug,
      superAdminPassword: envelope.superAdminPassword ?? undefined,
      isSyncing,
      switchRestaurant,
      loadRestaurant,
      createRestaurant,
      updateRestaurant,
      deleteRestaurant,
      updateActiveRestaurantRecord,
      refreshRestaurants,
      refreshStoreStatus,
    }),
    [
      envelope.restaurants,
      activeRestaurant,
      effectiveRestaurantId,
      envelope.superAdminPassword,
      isSyncing,
      switchRestaurant,
      loadRestaurant,
      createRestaurant,
      updateRestaurant,
      deleteRestaurant,
      updateActiveRestaurantRecord,
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
