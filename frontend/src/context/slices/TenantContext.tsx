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
  updateRestaurant: (id: string, updates: Partial<RestaurantRecord>) => void
  deleteRestaurant: (id: string) => void
  updateActiveRestaurantRecord: (updater: (current: RestaurantRecord) => RestaurantRecord) => void
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

  const [activeRestaurantId, setActiveRestaurantId] = useState<string>(() => {
    const saved = repository.getActiveRestaurantId(
      envelope.restaurants[0]?.id || "rest-burger-craft"
    )
    if (envelope.restaurants.some((r) => r.id === saved || r.slug === saved)) {
      return saved
    }
    return envelope.restaurants[0]?.id || "rest-burger-craft"
  })

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
      }
    },
    [envelope.restaurants]
  )

  const updateActiveRestaurantRecord = useCallback(
    (updater: (current: RestaurantRecord) => RestaurantRecord) => {
      setEnvelope((prev) => {
        const exists = prev.restaurants.some((r) => r.id === activeRestaurant.id)
        if (!exists) {
          const updated = updater(activeRestaurant)
          return {
            ...prev,
            restaurants: [updated, ...prev.restaurants],
          }
        }
        return {
          ...prev,
          restaurants: prev.restaurants.map((r) =>
            r.id === activeRestaurant.id ? updater(r) : r
          ),
        }
      })
    },
    [activeRestaurant]
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
      toast.success(`Restaurante "${data.name}" creado exitosamente`)
      return newRecord
    },
    []
  )

  const updateRestaurant = useCallback(
    (id: string, updates: Partial<RestaurantRecord>) => {
      setEnvelope((prev) => ({
        ...prev,
        restaurants: prev.restaurants.map((r) =>
          r.id === id ? { ...r, ...updates } : r
        ),
      }))
    },
    []
  )

  const deleteRestaurant = useCallback(
    (id: string) => {
      if (envelope.restaurants.length <= 1) {
        toast.error("Debe existir al menos un restaurante en la plataforma.")
        return
      }
      setEnvelope((prev) => {
        const remaining = prev.restaurants.filter((r) => r.id !== id)
        if (activeRestaurantId === id && remaining[0]) {
          setActiveRestaurantId(remaining[0].id)
        }
        return {
          ...prev,
          restaurants: remaining,
        }
      })
      toast.success("Restaurante eliminado correctamente")
    },
    [envelope.restaurants.length, activeRestaurantId]
  )

  const globalStats = useMemo<GlobalPlatformStats>(() => {
    let totalRevenue = 0
    let totalOrders = 0
    let totalCustomers = 0

    envelope.restaurants.forEach((r) => {
      totalRevenue += r.orders
        .filter((o) => o.status !== "cancelled")
        .reduce((sum, o) => sum + o.finalTotal, 0)
      totalOrders += r.orders.length
      totalCustomers += r.customers.length
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
    switchRestaurant,
    createRestaurant,
    updateRestaurant,
    deleteRestaurant,
    updateActiveRestaurantRecord,
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
