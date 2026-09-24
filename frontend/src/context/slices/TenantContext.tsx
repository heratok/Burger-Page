import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react"
import type {
  RestaurantRecord,
  StorageEnvelopeV2,
} from "@/types/restaurant"
import { DEFAULT_STORE_CONFIG } from "@/constants/themePresets"
import {
  TenantRepository,
  defaultTenantRepository,
} from "@/core/storage/TenantRepository"
import { apiClient, isNotFoundError } from "@/core/api/apiClient"
import { useAuth } from "./AuthContext"
import { toast } from "sonner"
import { nextTempId } from "@/lib/ids"

export interface GlobalPlatformStats {
  totalRevenue: number
  totalOrders: number
  totalRestaurants: number
  activeRestaurants: number
  totalCustomers: number
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
  globalStats: GlobalPlatformStats
}

const TenantContext = createContext<TenantContextType | undefined>(undefined)

export const TenantProvider: React.FC<{
  children: React.ReactNode
  repository?: TenantRepository
}> = ({ children, repository = defaultTenantRepository }) => {
  const [envelope, setEnvelope] = useState<StorageEnvelopeV2>(() =>
    repository.loadEnvelope()
  )
  const [isSyncing, setIsSyncing] = useState<boolean>(false)

  const [activeRestaurantId, setActiveRestaurantId] = useState<string>(() => {
    const saved = repository.getActiveRestaurantId(
      envelope.restaurants[0]?.id || "rest-burger-craft"
    )
    if (envelope.restaurants.some((r) => r.id === saved || r.slug === saved)) {
      return saved
    }
    return envelope.restaurants[0]?.id || "rest-burger-craft"
  })

  const refreshRestaurants = useCallback(async () => {
    setIsSyncing(true)
    try {
      const backendRestaurants = await apiClient.listRestaurants()
      if (Array.isArray(backendRestaurants)) {
        setEnvelope((prev) => {
          const diskEnvelope = repository.loadEnvelope()
          const merged = backendRestaurants.map((br: any) => {
            const local =
              prev.restaurants.find((r) => r.id === br.id || r.slug === br.slug) ||
              diskEnvelope.restaurants.find((r) => r.id === br.id || r.slug === br.slug)
            // SUS-20: never re-merge the one-time admin password into the
            // envelope — not from backend responses and not from legacy local
            // records; the secret must not ride along on refresh.
            const { adminPassword: _legacySecret, ...safeLocal } =
              local || ({} as Partial<RestaurantRecord>)
            return {
              ...safeLocal,
              id: br.id,
              slug: br.slug,
              isActive: br.isActive !== undefined ? Boolean(br.isActive) : true,
              createdAt: br.createdAt || local?.createdAt || new Date().toISOString(),
              categories: br.categories && br.categories.length > 0 ? br.categories : local?.categories || ['General'],
              config: {
                ...DEFAULT_STORE_CONFIG,
                ...(local?.config || {}),
                ...(br.config || {}),
                name: br.name || br.config?.name || local?.config?.name || DEFAULT_STORE_CONFIG.name,
                tagline: br.tagline || br.config?.tagline || local?.config?.tagline || DEFAULT_STORE_CONFIG.tagline,
              },
              products: local?.products || [],
              additions: local?.additions || [],
              orders: local?.orders || [],
              customers: local?.customers || [],
              inventory: local?.inventory || [],
              suppliers: local?.suppliers || [],
            } as RestaurantRecord
          })
          return {
            ...prev,
            restaurants: merged,
          }
        })
      }
    } catch (err) {
      if (import.meta.env?.MODE !== 'test') {
        console.warn("Could not sync restaurants from backend API:", err)
      }
    } finally {
      setIsSyncing(false)
    }
  }, [repository])

  const { session } = useAuth()

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
    refreshRestaurants()
  }, [refreshRestaurants, session])

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
      ) || envelope.restaurants[0]

    return (
      found || {
        id: "rest-default",
        slug: "default",
        isActive: true,
        createdAt: new Date().toISOString(),
        config: DEFAULT_STORE_CONFIG,
        products: [],
        additions: [],
        orders: [],
        customers: [],
      }
    )
  }, [envelope.restaurants, effectiveRestaurantId])

  const switchRestaurant = useCallback(
    (idOrSlug: string) => {
      const target = envelope.restaurants.find(
        (r) => r.id === idOrSlug || r.slug === idOrSlug
      )
      // M5: a restaurant admin must never live-switch the active tenant (neither
      // by direct /slug navigation nor via the fetch fallback below). Only their
      // own session-bound restaurant is allowed; guests (storefront/landing) and
      // super admins keep the full switcher behavior.
      if (session.role === "restaurant" && session.restaurantId) {
        if (!target || target.id !== session.restaurantId) {
          toast.warning("Solo podés operar tu propio restaurante")
          return
        }
      }
      if (target) {
        setActiveRestaurantId(target.id)
      } else {
        apiClient
          .fetchRestaurant(idOrSlug)
          .then((fetched) => {
            if (fetched && fetched.id) {
              setEnvelope((prev) => {
                if (prev.restaurants.some((r) => r.id === fetched.id || r.slug === fetched.slug)) {
                  return prev
                }
                const formatted: RestaurantRecord = {
                  id: fetched.id,
                  slug: fetched.slug,
                  isActive: fetched.isActive !== undefined ? Boolean(fetched.isActive) : true,
                  createdAt: (fetched as any).createdAt || new Date().toISOString(),
                  categories: fetched.categories && fetched.categories.length > 0 ? fetched.categories : ['Hamburguesas', 'Bebidas', 'Acompañamientos'],
                  config: {
                    ...DEFAULT_STORE_CONFIG,
                    ...(fetched.config || {}),
                    name: (fetched as any).name || (fetched.config as any)?.name || DEFAULT_STORE_CONFIG.name,
                  },
                  products: (fetched as any).products || [],
                  additions: (fetched as any).additions || [],
                  orders: (fetched as any).orders || [],
                  customers: (fetched as any).customers || [],
                  inventory: (fetched as any).inventory || [],
                  suppliers: (fetched as any).suppliers || [],
                }
                return {
                  ...prev,
                  restaurants: [formatted, ...prev.restaurants],
                }
              })
              setActiveRestaurantId(fetched.id)
            }
          })
          .catch(() => {})
      }
    },
    [envelope.restaurants, session.role, session.restaurantId]
  )

  const updateActiveRestaurantRecord = useCallback(
    (updater: (current: RestaurantRecord) => RestaurantRecord) => {
      setEnvelope((prev) => {
        // M10: bind the mutation to the session-aware effective tenant. When the
        // target is a stub/unknown id (e.g. the record vanished after a backend
        // refresh), create a NEW record with id targetId instead of silently
        // redirecting the write to prev.restaurants[0] (another tenant's record).
        const targetId = effectiveRestaurantId || prev.restaurants[0]?.id || "rest-burger-craft"
        const target =
          prev.restaurants.find((r) => r.id === targetId) || {
            id: targetId,
            slug: targetId.replace(/^rest-/, ""),
            isActive: true,
            createdAt: new Date().toISOString(),
            config: DEFAULT_STORE_CONFIG,
            categories: ["Platos Principales"],
            products: [],
            additions: [],
            orders: [],
            customers: [],
            inventory: [],
            suppliers: [],
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
        categories: ["General"],
        products: [],
        additions: [],
        orders: [],
        customers: [],
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
          categories: ["General"],
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

      setEnvelope((prev) => ({
        ...prev,
        restaurants: prev.restaurants.map((r) =>
          r.id === id || r.slug === id ? { ...r, ...updates } : r
        ),
      }))

      if (updates.isActive !== undefined) {
        toast.success(
          updates.isActive ? "Restaurante activado" : "Restaurante pausado temporalmente"
        )
      } else {
        toast.success("Restaurante actualizado correctamente")
      }

      try {
        await apiClient.updateRestaurant(targetId, {
          name: updates.config?.name || target?.config?.name,
          slug: updates.slug || target?.slug,
          tagline: updates.config?.tagline || target?.config?.tagline,
          whatsappNumber: updates.config?.whatsappNumber || target?.config?.whatsappNumber,
          primaryColor: updates.config?.primaryColor || target?.config?.primaryColor,
          theme: updates.config?.bgTheme || target?.config?.bgTheme,
          isActive: updates.isActive,
          config: updates.config || target?.config,
          categories: updates.categories || target?.categories,
        })
      } catch (err) {
        if (import.meta.env?.MODE !== 'test') {
          console.warn("Could not update restaurant on backend API, rolling back:", err)
        }
        setEnvelope(snapshot)
        toast.error("No se pudo actualizar el restaurante en el servidor. Cambios revertidos.")
      }
    },
    [envelope]
  )

  const deleteRestaurant = useCallback(
    async (id: string) => {
      const snapshot = envelope
      setEnvelope((prev) => ({
        ...prev,
        restaurants: prev.restaurants.map((r) =>
          (r.id === id || r.slug === id) ? { ...r, isActive: false } : r
        ),
      }))

      toast.success("Restaurante eliminado correctamente")

      try {
        await apiClient.deleteRestaurant(id)
      } catch (err) {
        if (isNotFoundError(err)) {
          // Resource already absent on server: preserve client deletion without rollback
          return
        }
        if (import.meta.env?.MODE !== 'test') {
          console.warn("Could not soft delete restaurant from backend API, rolling back:", err)
        }
        // Rollback state on backend rejection
        setEnvelope(snapshot)
        toast.error("No se pudo desactivar el restaurante en el servidor. Cambios revertidos.")
      }
    },
    [envelope]
  )

  const globalStats = useMemo<GlobalPlatformStats>(() => {
    let totalRevenue = 0
    let totalOrders = 0
    let totalCustomers = 0

    envelope.restaurants.forEach((r) => {
      const orders = r.orders || []
      const customers = r.customers || []
      totalRevenue += orders
        .filter((o) => o.status !== "cancelled")
        .reduce((sum, o) => sum + (o.finalTotal || 0), 0)
      totalOrders += orders.length
      totalCustomers += customers.length
    })

    return {
      totalRevenue,
      totalOrders,
      totalRestaurants: envelope.restaurants.length,
      activeRestaurants: envelope.restaurants.filter((r) => r.isActive).length,
      totalCustomers,
    }
  }, [envelope.restaurants])

  const value: TenantContextType = {
    restaurants: envelope.restaurants,
    activeRestaurant,
    effectiveRestaurantId,
    activeRestaurantId: activeRestaurant.id,
    activeRestaurantSlug: activeRestaurant.slug,
    superAdminPassword: envelope.superAdminPassword ?? undefined,
    isSyncing,
    switchRestaurant,
    createRestaurant,
    updateRestaurant,
    deleteRestaurant,
    updateActiveRestaurantRecord,
    refreshRestaurants,
    globalStats,
  }

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

export const useTenant = (): TenantContextType => {
  const context = useContext(TenantContext)
  if (!context) {
    throw new Error("useTenant must be used within a TenantProvider")
  }
  return context
}
