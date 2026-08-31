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
import { apiClient } from "@/core/api/apiClient"
import { toast } from "sonner"

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
  activeRestaurantId: string
  activeRestaurantSlug: string
  superAdminPassword: string
  isSyncing: boolean
  switchRestaurant: (idOrSlug: string) => void
  createRestaurant: (data: {
    name: string
    slug: string
    tagline: string
    whatsappNumber: string
    adminPassword?: string
    primaryColor?: string
    templateType?: "burger" | "pizza" | "tacos" | "blank"
  }) => RestaurantRecord
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
            return {
              ...local,
              id: br.id,
              slug: br.slug,
              adminPassword: br.adminPassword || local?.adminPassword || "admin123",
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

  // Sync with Backend DB on mount
  useEffect(() => {
    refreshRestaurants()
  }, [refreshRestaurants])

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
        (r) => r.id === activeRestaurantId || r.slug === activeRestaurantId
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
  }, [envelope.restaurants, activeRestaurantId])

  const switchRestaurant = useCallback(
    (idOrSlug: string) => {
      const target = envelope.restaurants.find(
        (r) => r.id === idOrSlug || r.slug === idOrSlug
      )
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
                  adminPassword: (fetched as any).adminPassword || "admin123",
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
    [envelope.restaurants]
  )

  const updateActiveRestaurantRecord = useCallback(
    (updater: (current: RestaurantRecord) => RestaurantRecord) => {
      setEnvelope((prev) => {
        const targetId = activeRestaurantId || prev.restaurants[0]?.id
        const target = prev.restaurants.find((r) => r.id === targetId || r.slug === targetId) || prev.restaurants[0]
        if (!target) return prev

        const updated = updater(target)
        return {
          ...prev,
          restaurants: prev.restaurants.map((r) =>
            (r.id === target.id || r.slug === target.slug) ? updated : r
          ),
        }
      })
    },
    [activeRestaurantId]
  )

  const createRestaurant = useCallback(
    (data: {
      name: string
      slug: string
      tagline: string
      whatsappNumber: string
      adminPassword?: string
      primaryColor?: string
      templateType?: "burger" | "pizza" | "tacos" | "blank"
    }) => {
      const cleanSlug = data.slug
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")

      const newRecord: RestaurantRecord = {
        id: `rest-${Date.now()}`,
        slug: cleanSlug || `rest-${Date.now().toString(36)}`,
        adminPassword: data.adminPassword || "admin123",
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
          primaryColor: data.primaryColor,
          templateType: data.templateType,
          categories: ["General"],
          config: newRecord.config,
        })
        .then((created) => {
          if (created && created.id) {
            setEnvelope((prev) => ({
              ...prev,
              restaurants: prev.restaurants.map((r) =>
                r.id === newRecord.id ? { ...r, id: created.id } : r
              ),
            }))
          }
        })
        .catch((err) => {
          if (import.meta.env?.MODE !== 'test') {
            console.warn("Could not persist restaurant to backend API:", err)
          }
        })

      toast.success(`Restaurante "${data.name}" creado exitosamente`)
      return newRecord
    },
    []
  )

  const updateRestaurant = useCallback(
    async (id: string, updates: Partial<RestaurantRecord>) => {
      setEnvelope((prev) => ({
        ...prev,
        restaurants: prev.restaurants.map((r) =>
          r.id === id ? { ...r, ...updates } : r
        ),
      }))

      if (updates.isActive !== undefined) {
        toast.success(
          updates.isActive ? "Restaurante activado" : "Restaurante pausado temporalmente"
        )
      } else {
        toast.success("Restaurante actualizado correctamente")
      }
    },
    []
  )

  const deleteRestaurant = useCallback(
    async (id: string) => {
      const snapshot = envelope
      setEnvelope((prev) => ({
        ...prev,
        restaurants: prev.restaurants.filter((r) => r.id !== id && r.slug !== id),
      }))

      toast.success("Restaurante eliminado correctamente")

      try {
        await apiClient.deleteRestaurant(id)
      } catch (err) {
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
    activeRestaurantId: activeRestaurant.id,
    activeRestaurantSlug: activeRestaurant.slug,
    superAdminPassword: envelope.superAdminPassword,
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
