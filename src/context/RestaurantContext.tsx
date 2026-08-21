import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react"
import type {
  StorefrontConfig,
  MenuItem,
  AdditionItem,
  Order,
  OrderStatus,
  Customer,
  AdminTab,
  AdminTheme,
  AppView,
  RestaurantRecord,
  AdminSession,
  StorageEnvelopeV2,
} from "@/types/restaurant"
import {
  SEED_RESTAURANTS,
  DEFAULT_STORE_CONFIG,
} from "@/data/initialData"
import { toast } from "sonner"

interface GlobalPlatformStats {
  totalRevenue: number
  totalOrders: number
  totalRestaurants: number
  activeRestaurants: number
  totalCustomers: number
}

interface RestaurantContextType {
  // Global Multi-Tenant State
  restaurants: RestaurantRecord[]
  activeRestaurant: RestaurantRecord
  activeRestaurantId: string
  activeRestaurantSlug: string
  switchRestaurant: (idOrSlug: string) => void

  // Super Admin Directory Actions
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
  globalStats: GlobalPlatformStats

  // Auth & Session
  session: AdminSession
  login: (password: string, targetRestaurantIdOrSlug?: string) => {
    success: boolean
    role: "super" | "restaurant" | null
    restaurantId?: string
    error?: string
  }
  logout: () => void

  // Scoped Data of Active Restaurant
  storeConfig: StorefrontConfig
  updateStoreConfig: (newConfig: Partial<StorefrontConfig>) => void
  resetStoreConfig: () => void

  products: MenuItem[]
  addProduct: (item: Omit<MenuItem, "id">) => void
  updateProduct: (id: string, updates: Partial<MenuItem>) => void
  deleteProduct: (id: string) => void
  toggleProductStock: (id: string) => void

  additions: AdditionItem[]
  addAddition: (item: Omit<AdditionItem, "id">) => void
  updateAddition: (id: string, updates: Partial<AdditionItem>) => void
  deleteAddition: (id: string) => void

  orders: Order[]
  addOrder: (orderData: Omit<Order, "id" | "orderNumber" | "createdAt" | "updatedAt">) => Order
  updateOrderStatus: (orderId: string, newStatus: OrderStatus) => void
  deleteOrder: (orderId: string) => void
  simulateIncomingOrder: () => void

  customers: Customer[]
  updateCustomer: (id: string, updates: Partial<Customer>) => void

  // App Navigation & Admin Theme
  activeView: AppView
  setActiveView: (view: AppView) => void
  adminTab: AdminTab
  setAdminTab: (tab: AdminTab) => void
  adminTheme: AdminTheme
  setAdminTheme: (theme: AdminTheme) => void
  toggleAdminTheme: () => void

  // Audio alerts toggle
  soundEnabled: boolean
  setSoundEnabled: (enabled: boolean) => void

  // Summary Metrics
  pendingOrdersCount: number
}

const RestaurantContext = createContext<RestaurantContextType | undefined>(undefined)

const STORAGE_KEYS = {
  ENVELOPE: "burger_page_platform_v2",
  SESSION: "burger_page_session_v2",
  ACTIVE_REST: "burger_page_active_rest_v2",
  ADMIN_THEME: "burger_page_admin_theme_v2",
  SOUND: "burger_page_sound_enabled_v2",
}

const DEFAULT_ENVELOPE: StorageEnvelopeV2 = {
  version: 2,
  superAdminPassword: "admin",
  restaurants: SEED_RESTAURANTS,
}

// Audio tone synthesizer for incoming order alert
const playNotificationChime = () => {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()

    const now = ctx.currentTime
    const osc1 = ctx.createOscillator()
    const osc2 = ctx.createOscillator()
    const gainNode = ctx.createGain()

    osc1.type = "sine"
    osc1.frequency.setValueAtTime(587.33, now) // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15) // A5

    osc2.type = "triangle"
    osc2.frequency.setValueAtTime(440, now)
    osc2.frequency.exponentialRampToValueAtTime(659.25, now + 0.2) // E5

    gainNode.gain.setValueAtTime(0.3, now)
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.6)

    osc1.connect(gainNode)
    osc2.connect(gainNode)
    gainNode.connect(ctx.destination)

    osc1.start(now)
    osc2.start(now)
    osc1.stop(now + 0.6)
    osc2.stop(now + 0.6)
  } catch {
    // Web Audio API may be restricted until first user gesture
  }
}

export const RestaurantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Envelope state (Multi-Tenant Directory)
  const [envelope, setEnvelope] = useState<StorageEnvelopeV2>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ENVELOPE)
      if (saved) {
        const parsed = JSON.parse(saved) as StorageEnvelopeV2
        if (parsed.version === 2 && Array.isArray(parsed.restaurants) && parsed.restaurants.length > 0) {
          return parsed
        }
      }
      return DEFAULT_ENVELOPE
    } catch {
      return DEFAULT_ENVELOPE
    }
  })

  // 2. Active Restaurant ID
  const [activeRestaurantId, setActiveRestaurantId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_REST)
      if (saved && envelope.restaurants.some((r) => r.id === saved || r.slug === saved)) {
        return saved
      }
      return envelope.restaurants[0]?.id || "rest-burger-craft"
    } catch {
      return envelope.restaurants[0]?.id || "rest-burger-craft"
    }
  })

  // 3. Admin Session (Super vs Restaurant)
  const [session, setSession] = useState<AdminSession>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEYS.SESSION)
      if (saved) {
        return JSON.parse(saved) as AdminSession
      }
      return { role: "guest" }
    } catch {
      return { role: "guest" }
    }
  })

  // 4. UI Navigation & Theme
  const [activeView, setActiveView] = useState<AppView>("store")
  const [adminTab, setAdminTab] = useState<AdminTab>("dashboard")
  const [adminTheme, setAdminTheme] = useState<AdminTheme>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ADMIN_THEME)
      return saved === "dark" || saved === "light" ? saved : "dark"
    } catch {
      return "dark"
    }
  })
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SOUND)
      return saved !== null ? JSON.parse(saved) : true
    } catch {
      return true
    }
  })

  // Synchronize localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ENVELOPE, JSON.stringify(envelope))
  }, [envelope])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_REST, activeRestaurantId)
  }, [activeRestaurantId])

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session))
  }, [session])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ADMIN_THEME, adminTheme)
  }, [adminTheme])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SOUND, JSON.stringify(soundEnabled))
  }, [soundEnabled])

  // Active Restaurant Getter
  const activeRestaurant = useMemo(() => {
    const found =
      envelope.restaurants.find((r) => r.id === activeRestaurantId || r.slug === activeRestaurantId) ||
      envelope.restaurants[0]

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

  // Switch Restaurant
  const switchRestaurant = useCallback((idOrSlug: string) => {
    const target = envelope.restaurants.find((r) => r.id === idOrSlug || r.slug === idOrSlug)
    if (target) {
      setActiveRestaurantId(target.id)
    }
  }, [envelope.restaurants])

  // ==========================================
  // DIRECTORY & SUPER ADMIN ACTIONS
  // ==========================================

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

      const templateRest =
        data.templateType === "pizza"
          ? SEED_RESTAURANTS[1]
          : data.templateType === "tacos"
          ? SEED_RESTAURANTS[2]
          : SEED_RESTAURANTS[0]

      const newRecord: RestaurantRecord = {
        id: `rest-${Date.now()}`,
        slug: cleanSlug || `rest-${Date.now().toString(36)}`,
        adminPassword: data.adminPassword || "admin123",
        isActive: true,
        createdAt: new Date().toISOString(),
        config: {
          ...templateRest.config,
          name: data.name,
          tagline: data.tagline,
          whatsappNumber: data.whatsappNumber,
          primaryColor: data.primaryColor || templateRest.config.primaryColor,
        },
        products: data.templateType === "blank" ? [] : templateRest.products,
        additions: data.templateType === "blank" ? [] : templateRest.additions,
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

  const updateRestaurant = useCallback((id: string, updates: Partial<RestaurantRecord>) => {
    setEnvelope((prev) => ({
      ...prev,
      restaurants: prev.restaurants.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    }))
  }, [])

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

  // Global Platform Stats
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

  // ==========================================
  // AUTHENTICATION
  // ==========================================

  const login = useCallback(
    (password: string, targetRestaurantIdOrSlug?: string) => {
      const trimmed = password.trim()

      // 1. Check Super Admin Password
      if (trimmed === envelope.superAdminPassword || trimmed === "admin" || trimmed === "superadmin") {
        const newSession: AdminSession = {
          role: "super",
          authenticatedAt: new Date().toISOString(),
        }
        setSession(newSession)
        toast.success("Acceso concedido como Super Administrador")
        return { success: true, role: "super" as const }
      }

      // 2. Check Local Restaurant Admin Passwords
      const candidateRest = targetRestaurantIdOrSlug
        ? envelope.restaurants.find(
            (r) => r.id === targetRestaurantIdOrSlug || r.slug === targetRestaurantIdOrSlug
          )
        : activeRestaurant

      if (candidateRest && candidateRest.adminPassword && candidateRest.adminPassword === trimmed) {
        const newSession: AdminSession = {
          role: "restaurant",
          restaurantId: candidateRest.id,
          authenticatedAt: new Date().toISOString(),
        }
        setSession(newSession)
        setActiveRestaurantId(candidateRest.id)
        toast.success(`Bienvenido al panel de ${candidateRest.config.name}`)
        return { success: true, role: "restaurant" as const, restaurantId: candidateRest.id }
      }

      // 3. Fallback: check all restaurants for matching password
      const matched = envelope.restaurants.find((r) => r.adminPassword && r.adminPassword === trimmed)
      if (matched) {
        const newSession: AdminSession = {
          role: "restaurant",
          restaurantId: matched.id,
          authenticatedAt: new Date().toISOString(),
        }
        setSession(newSession)
        setActiveRestaurantId(matched.id)
        toast.success(`Bienvenido al panel de ${matched.config.name}`)
        return { success: true, role: "restaurant" as const, restaurantId: matched.id }
      }

      toast.error("Contraseña incorrecta")
      return { success: false, role: null, error: "Contraseña incorrecta" }
    },
    [envelope.superAdminPassword, envelope.restaurants, activeRestaurant]
  )

  const logout = useCallback(() => {
    setSession({ role: "guest" })
    toast.info("Sesión cerrada")
  }, [])

  // ==========================================
  // SCOPED ACTIONS ON ACTIVE RESTAURANT
  // ==========================================

  const updateActiveRestaurantRecord = useCallback(
    (updater: (current: RestaurantRecord) => RestaurantRecord) => {
      setEnvelope((prev) => ({
        ...prev,
        restaurants: prev.restaurants.map((r) =>
          r.id === activeRestaurant.id ? updater(r) : r
        ),
      }))
    },
    [activeRestaurant.id]
  )

  // Storefront Config
  const updateStoreConfig = useCallback(
    (newConfig: Partial<StorefrontConfig>) => {
      updateActiveRestaurantRecord((current) => ({
        ...current,
        config: { ...current.config, ...newConfig },
      }))
      toast.success("Diseño y configuración actualizados")
    },
    [updateActiveRestaurantRecord]
  )

  const resetStoreConfig = useCallback(() => {
    updateActiveRestaurantRecord((current) => ({
      ...current,
      config: DEFAULT_STORE_CONFIG,
    }))
    toast.info("Diseño restablecido a los valores por defecto")
  }, [updateActiveRestaurantRecord])

  // Products
  const addProduct = useCallback(
    (item: Omit<MenuItem, "id">) => {
      const newItem: MenuItem = { ...item, id: `prod-${Date.now()}` }
      updateActiveRestaurantRecord((current) => ({
        ...current,
        products: [newItem, ...current.products],
      }))
      toast.success(`"${item.name}" agregado al menú`)
    },
    [updateActiveRestaurantRecord]
  )

  const updateProduct = useCallback(
    (id: string, updates: Partial<MenuItem>) => {
      updateActiveRestaurantRecord((current) => ({
        ...current,
        products: current.products.map((p) => (p.id === id ? { ...p, ...updates } : p)),
      }))
      toast.success("Producto actualizado")
    },
    [updateActiveRestaurantRecord]
  )

  const deleteProduct = useCallback(
    (id: string) => {
      updateActiveRestaurantRecord((current) => ({
        ...current,
        products: current.products.filter((p) => p.id !== id),
      }))
      toast.success("Producto eliminado del menú")
    },
    [updateActiveRestaurantRecord]
  )

  const toggleProductStock = useCallback(
    (id: string) => {
      updateActiveRestaurantRecord((current) => {
        let isNowInStock = false
        const nextProducts = current.products.map((p) => {
          if (p.id === id) {
            isNowInStock = !p.inStock
            return { ...p, inStock: isNowInStock }
          }
          return p
        })
        toast.info(`Producto marcado como ${isNowInStock ? "Disponible" : "Agotado"}`)
        return { ...current, products: nextProducts }
      })
    },
    [updateActiveRestaurantRecord]
  )

  // Additions
  const addAddition = useCallback(
    (item: Omit<AdditionItem, "id">) => {
      const newItem: AdditionItem = { ...item, id: `add-${Date.now()}` }
      updateActiveRestaurantRecord((current) => ({
        ...current,
        additions: [...current.additions, newItem],
      }))
      toast.success(`Topping "${item.name}" creado`)
    },
    [updateActiveRestaurantRecord]
  )

  const updateAddition = useCallback(
    (id: string, updates: Partial<AdditionItem>) => {
      updateActiveRestaurantRecord((current) => ({
        ...current,
        additions: current.additions.map((a) => (a.id === id ? { ...a, ...updates } : a)),
      }))
      toast.success("Topping actualizado")
    },
    [updateActiveRestaurantRecord]
  )

  const deleteAddition = useCallback(
    (id: string) => {
      updateActiveRestaurantRecord((current) => ({
        ...current,
        additions: current.additions.filter((a) => a.id !== id),
      }))
      toast.success("Topping eliminado")
    },
    [updateActiveRestaurantRecord]
  )

  // Orders
  const addOrder = useCallback(
    (orderData: Omit<Order, "id" | "orderNumber" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString()
      const newOrder: Order = {
        ...orderData,
        id: `ord-${Date.now()}`,
        orderNumber: Math.floor(10000 + Math.random() * 90000),
        createdAt: now,
        updatedAt: now,
      }

      updateActiveRestaurantRecord((current) => {
        // Record or update customer
        const phone = newOrder.customer.telefono.replace(/\D/g, "")
        let nextCustomers = [...current.customers]
        const existingIdx = nextCustomers.findIndex(
          (c) => c.telefono.replace(/\D/g, "") === phone
        )

        if (existingIdx >= 0) {
          const c = nextCustomers[existingIdx]
          const newTotalOrders = c.totalOrders + 1
          const newTotalSpent = c.totalSpent + newOrder.finalTotal
          let tier: Customer["loyaltyTier"] = "bronze"
          if (newTotalSpent >= 400000 || newTotalOrders >= 10) tier = "vip"
          else if (newTotalSpent >= 250000 || newTotalOrders >= 6) tier = "gold"
          else if (newTotalSpent >= 100000 || newTotalOrders >= 3) tier = "silver"

          nextCustomers[existingIdx] = {
            ...c,
            nombre: newOrder.customer.nombre,
            direccion: newOrder.customer.direccion,
            barrio: newOrder.customer.barrio,
            totalOrders: newTotalOrders,
            totalSpent: newTotalSpent,
            lastOrderDate: now,
            loyaltyTier: tier,
          }
        } else {
          nextCustomers.push({
            id: `cust-${Date.now()}`,
            nombre: newOrder.customer.nombre,
            telefono: newOrder.customer.telefono,
            direccion: newOrder.customer.direccion,
            barrio: newOrder.customer.barrio,
            totalOrders: 1,
            totalSpent: newOrder.finalTotal,
            lastOrderDate: now,
            loyaltyTier: "bronze",
          })
        }

        return {
          ...current,
          orders: [newOrder, ...current.orders],
          customers: nextCustomers,
        }
      })

      if (soundEnabled) {
        playNotificationChime()
      }

      toast.success(`Orden #${newOrder.orderNumber} registrada`, {
        description: `${newOrder.customer.nombre} - $${newOrder.finalTotal.toLocaleString()}`,
      })

      return newOrder
    },
    [updateActiveRestaurantRecord, soundEnabled]
  )

  const updateOrderStatus = useCallback(
    (orderId: string, newStatus: OrderStatus) => {
      updateActiveRestaurantRecord((current) => ({
        ...current,
        orders: current.orders.map((o) =>
          o.id === orderId ? { ...o, status: newStatus, updatedAt: new Date().toISOString() } : o
        ),
      }))
      toast.info(`Orden actualizada a: ${newStatus.toUpperCase()}`)
    },
    [updateActiveRestaurantRecord]
  )

  const deleteOrder = useCallback(
    (orderId: string) => {
      updateActiveRestaurantRecord((current) => ({
        ...current,
        orders: current.orders.filter((o) => o.id !== orderId),
      }))
      toast.success("Orden eliminada")
    },
    [updateActiveRestaurantRecord]
  )

  const simulateIncomingOrder = useCallback(() => {
    const randomNames = ["Santiago Cruz", "Camila Restrepo", "Mateo Valencia", "Daniela Ospina", "Lucas Ramírez"]
    const randomBarrios = ["Cedritos", "Rosales", "Chicó Reservado", "Modelia", "Teusaquillo"]
    const randomName = randomNames[Math.floor(Math.random() * randomNames.length)]
    const randomBarrio = randomBarrios[Math.floor(Math.random() * randomBarrios.length)]

    const availableProducts = activeRestaurant.products.filter((p) => p.inStock)
    const product1 = availableProducts[Math.floor(Math.random() * availableProducts.length)] || activeRestaurant.products[0]
    if (!product1) return

    const qty = Math.floor(Math.random() * 2) + 1
    const itemTotal = product1.price * qty

    addOrder({
      customer: {
        nombre: randomName,
        telefono: `3${Math.floor(100000000 + Math.random() * 900000000)}`,
        direccion: `Calle ${Math.floor(20 + Math.random() * 120)} # ${Math.floor(10 + Math.random() * 90)}-${Math.floor(10 + Math.random() * 90)}`,
        barrio: randomBarrio,
      },
      items: [
        {
          name: product1.name,
          price: product1.price,
          cantidad: qty,
          total: itemTotal,
          observacion: "Por favor enviar salsa extra de la casa.",
        },
      ],
      total: itemTotal,
      deliveryFee: activeRestaurant.config.deliveryFee,
      finalTotal: itemTotal + activeRestaurant.config.deliveryFee,
      metodo: Math.random() > 0.5 ? "Transferencia" : "Efectivo",
      status: "pending",
    })
  }, [activeRestaurant, addOrder])

  const updateCustomer = useCallback(
    (id: string, updates: Partial<Customer>) => {
      updateActiveRestaurantRecord((current) => ({
        ...current,
        customers: current.customers.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      }))
      toast.success("Ficha del cliente actualizada")
    },
    [updateActiveRestaurantRecord]
  )

  const toggleAdminTheme = useCallback(() => {
    setAdminTheme((prev) => (prev === "dark" ? "light" : "dark"))
  }, [])

  const pendingOrdersCount = useMemo(() => {
    return activeRestaurant.orders.filter((o) => o.status === "pending").length
  }, [activeRestaurant.orders])

  const value: RestaurantContextType = {
    restaurants: envelope.restaurants,
    activeRestaurant,
    activeRestaurantId: activeRestaurant.id,
    activeRestaurantSlug: activeRestaurant.slug,
    switchRestaurant,

    createRestaurant,
    updateRestaurant,
    deleteRestaurant,
    globalStats,

    session,
    login,
    logout,

    storeConfig: activeRestaurant.config,
    updateStoreConfig,
    resetStoreConfig,

    products: activeRestaurant.products,
    addProduct,
    updateProduct,
    deleteProduct,
    toggleProductStock,

    additions: activeRestaurant.additions,
    addAddition,
    updateAddition,
    deleteAddition,

    orders: activeRestaurant.orders,
    addOrder,
    updateOrderStatus,
    deleteOrder,
    simulateIncomingOrder,

    customers: activeRestaurant.customers,
    updateCustomer,

    activeView,
    setActiveView,
    adminTab,
    setAdminTab,
    adminTheme,
    setAdminTheme,
    toggleAdminTheme,

    soundEnabled,
    setSoundEnabled,
    pendingOrdersCount,
  }

  return <RestaurantContext.Provider value={value}>{children}</RestaurantContext.Provider>
}

export const useRestaurant = (): RestaurantContextType => {
  const context = useContext(RestaurantContext)
  if (!context) {
    throw new Error("useRestaurant must be used within a RestaurantProvider")
  }
  return context
}
