import React, { createContext, useContext, useEffect, useState, useMemo } from "react"
import { toast } from "sonner"
import type {
  StorefrontConfig,
  MenuItem,
  AdditionItem,
  Order,
  Customer,
  OrderStatus,
  AdminTab,
  AdminTheme,
  AppView,
} from "@/types/restaurant"
import {
  DEFAULT_STORE_CONFIG,
  INITIAL_MENU_ITEMS,
  INITIAL_ADDITIONS,
  INITIAL_ORDERS,
  INITIAL_CUSTOMERS,
} from "@/data/initialData"

interface RestaurantContextType {
  // Storefront Config & Theme
  storeConfig: StorefrontConfig
  updateStoreConfig: (updates: Partial<StorefrontConfig>) => void
  resetStoreConfig: () => void

  // Menu Items & Additions
  products: MenuItem[]
  addProduct: (item: Omit<MenuItem, "id">) => void
  updateProduct: (id: string, updates: Partial<MenuItem>) => void
  deleteProduct: (id: string) => void
  toggleProductStock: (id: string) => void

  additions: AdditionItem[]
  addAddition: (item: Omit<AdditionItem, "id">) => void
  updateAddition: (id: string, updates: Partial<AdditionItem>) => void
  deleteAddition: (id: string) => void

  // Orders Management
  orders: Order[]
  addOrder: (order: Omit<Order, "id" | "orderNumber" | "createdAt" | "updatedAt">) => Order
  updateOrderStatus: (id: string, newStatus: OrderStatus) => void
  deleteOrder: (id: string) => void
  simulateIncomingOrder: () => void

  // Customers CRM
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
  CONFIG: "burger_craft_config_v2",
  PRODUCTS: "burger_craft_products_v2",
  ADDITIONS: "burger_craft_additions_v2",
  ORDERS: "burger_craft_orders_v2",
  CUSTOMERS: "burger_craft_customers_v2",
  ADMIN_THEME: "burger_craft_admin_theme_v2",
  SOUND: "burger_craft_sound_enabled_v2",
}

export const RestaurantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Storefront Config
  const [storeConfig, setStoreConfig] = useState<StorefrontConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CONFIG)
      return saved ? { ...DEFAULT_STORE_CONFIG, ...JSON.parse(saved) } : DEFAULT_STORE_CONFIG
    } catch {
      return DEFAULT_STORE_CONFIG
    }
  })

  // 2. Menu Products
  const [products, setProducts] = useState<MenuItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PRODUCTS)
      return saved ? JSON.parse(saved) : INITIAL_MENU_ITEMS
    } catch {
      return INITIAL_MENU_ITEMS
    }
  })

  // 3. Additions
  const [additions, setAdditions] = useState<AdditionItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ADDITIONS)
      return saved ? JSON.parse(saved) : INITIAL_ADDITIONS
    } catch {
      return INITIAL_ADDITIONS
    }
  })

  // 4. Orders
  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ORDERS)
      return saved ? JSON.parse(saved) : INITIAL_ORDERS
    } catch {
      return INITIAL_ORDERS
    }
  })

  // 5. Customers
  const [customers, setCustomers] = useState<Customer[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CUSTOMERS)
      return saved ? JSON.parse(saved) : INITIAL_CUSTOMERS
    } catch {
      return INITIAL_CUSTOMERS
    }
  })

  // 6. Navigation & Admin Theme
  const [activeView, setActiveView] = useState<AppView>("store")
  const [adminTab, setAdminTab] = useState<AdminTab>("dashboard")
  const [adminTheme, setAdminTheme] = useState<AdminTheme>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ADMIN_THEME)
      return (saved === "dark" || saved === "light") ? saved : "dark"
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

  // Persistent Effects
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(storeConfig))
  }, [storeConfig])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products))
  }, [products])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ADDITIONS, JSON.stringify(additions))
  }, [additions])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders))
  }, [orders])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers))
  }, [customers])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ADMIN_THEME, adminTheme)
  }, [adminTheme])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SOUND, JSON.stringify(soundEnabled))
  }, [soundEnabled])

  // Play notification tone
  const playAlertSound = () => {
    if (!soundEnabled) return
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15) // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.35)
    } catch {
      // Audio context might be restricted before first user interaction
    }
  }

  // Operations
  const updateStoreConfig = (updates: Partial<StorefrontConfig>) => {
    setStoreConfig((prev) => ({ ...prev, ...updates }))
    toast.success("Diseño y configuración actualizados")
  }

  const resetStoreConfig = () => {
    setStoreConfig(DEFAULT_STORE_CONFIG)
    toast.info("Configuración restablecida a valores originales")
  }

  const addProduct = (item: Omit<MenuItem, "id">) => {
    const newItem: MenuItem = {
      ...item,
      id: `item-${Date.now()}`,
    }
    setProducts((prev) => [newItem, ...prev])
    toast.success(`"${item.name}" añadido a la carta`)
  }

  const updateProduct = (id: string, updates: Partial<MenuItem>) => {
    setProducts((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    )
    toast.success("Producto actualizado")
  }

  const deleteProduct = (id: string) => {
    const target = products.find((p) => p.id === id)
    setProducts((prev) => prev.filter((item) => item.id !== id))
    toast.success(`"${target?.name ?? "Producto"}" eliminado`)
  }

  const toggleProductStock = (id: string) => {
    setProducts((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nextState = !item.inStock
          toast.info(
            `"${item.name}" marcado como ${nextState ? "Disponible en carta" : "Agotado"}`
          )
          return { ...item, inStock: nextState }
        }
        return item
      })
    )
  }

  const addAddition = (item: Omit<AdditionItem, "id">) => {
    const newAdd: AdditionItem = { ...item, id: `add-${Date.now()}` }
    setAdditions((prev) => [...prev, newAdd])
    toast.success("Adición creada")
  }

  const updateAddition = (id: string, updates: Partial<AdditionItem>) => {
    setAdditions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    )
    toast.success("Adición actualizada")
  }

  const deleteAddition = (id: string) => {
    setAdditions((prev) => prev.filter((item) => item.id !== id))
    toast.success("Adición eliminada")
  }

  const addOrder = (
    orderData: Omit<Order, "id" | "orderNumber" | "createdAt" | "updatedAt">
  ): Order => {
    const randomOrderNumber = Math.floor(20000 + Math.random() * 80000)
    const newOrder: Order = {
      ...orderData,
      id: `ord-${Date.now()}`,
      orderNumber: randomOrderNumber,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    setOrders((prev) => [newOrder, ...prev])

    // Update or create customer profile in CRM
    setCustomers((prev) => {
      const existing = prev.find(
        (c) =>
          c.telefono.replace(/\D/g, "") ===
          newOrder.customer.telefono.replace(/\D/g, "")
      )
      if (existing) {
        const nextSpent = existing.totalSpent + newOrder.finalTotal
        const nextOrders = existing.totalOrders + 1
        const tier =
          nextSpent > 350000
            ? "vip"
            : nextSpent > 200000
            ? "gold"
            : nextSpent > 100000
            ? "silver"
            : "bronze"

        return prev.map((c) =>
          c.id === existing.id
            ? {
                ...c,
                totalOrders: nextOrders,
                totalSpent: nextSpent,
                loyaltyTier: tier,
                lastOrderDate: new Date().toISOString(),
                direccion: newOrder.customer.direccion || c.direccion,
                barrio: newOrder.customer.barrio || c.barrio,
              }
            : c
        )
      } else {
        const newCustomer: Customer = {
          id: `cust-${Date.now()}`,
          nombre: newOrder.customer.nombre,
          telefono: newOrder.customer.telefono,
          direccion: newOrder.customer.direccion,
          barrio: newOrder.customer.barrio,
          totalOrders: 1,
          totalSpent: newOrder.finalTotal,
          loyaltyTier: newOrder.finalTotal > 100000 ? "silver" : "bronze",
          lastOrderDate: new Date().toISOString(),
        }
        return [newCustomer, ...prev]
      }
    })

    playAlertSound()
    return newOrder
  }

  const updateOrderStatus = (id: string, newStatus: OrderStatus) => {
    setOrders((prev) =>
      prev.map((ord) =>
        ord.id === id
          ? { ...ord, status: newStatus, updatedAt: new Date().toISOString() }
          : ord
      )
    )

    const statusNames: Record<OrderStatus, string> = {
      pending: "🟡 Pendiente",
      cooking: "🟠 En Cocina",
      delivering: "🔵 En Reparto",
      delivered: "🟢 Entregado",
      cancelled: "🔴 Cancelado",
    }
    toast.success(`Pedido actualizado a ${statusNames[newStatus]}`)
  }

  const deleteOrder = (id: string) => {
    setOrders((prev) => prev.filter((ord) => ord.id !== id))
    toast.success("Pedido eliminado del registro")
  }

  const simulateIncomingOrder = () => {
    const mockNames = [
      "Sofía Vergara R.",
      "Mateo Londoño",
      "Camila Restrepo",
      "Daniel Osorio",
      "Isabella Quintero",
      "Andrés Felipe Castro",
    ]
    const mockAddresses = [
      { dir: "Calle 85 # 11-53, Apto 502", bar: "El Nogal" },
      { dir: "Carrera 7 # 127-10, Torre A", bar: "Bella Suiza" },
      { dir: "Transversal 19 # 104-32", bar: "Chicó Navarra" },
      { dir: "Calle 63 # 9-40, Casa 3", bar: "Chapinero Alto" },
    ]

    const randomName = mockNames[Math.floor(Math.random() * mockNames.length)]
    const randomLoc = mockAddresses[Math.floor(Math.random() * mockAddresses.length)]
    const randomProduct = products[Math.floor(Math.random() * products.length)] || INITIAL_MENU_ITEMS[0]

    const quantity = Math.floor(Math.random() * 2) + 1
    const itemTotal = randomProduct.price * quantity
    const totalOrder = itemTotal
    const finalTotal = totalOrder + storeConfig.deliveryFee

    const mockOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber: Math.floor(20000 + Math.random() * 80000),
      customer: {
        nombre: randomName,
        telefono: `31${Math.floor(10000000 + Math.random() * 90000000)}`,
        direccion: randomLoc.dir,
        barrio: randomLoc.bar,
      },
      items: [
        {
          name: randomProduct.name,
          price: randomProduct.price,
          cantidad: quantity,
          total: itemTotal,
          src: randomProduct.src,
          observacion: "Por favor bien caliente y con servilletas extra.",
        },
      ],
      total: totalOrder,
      deliveryFee: storeConfig.deliveryFee,
      finalTotal,
      metodo: Math.random() > 0.5 ? "Transferencia" : "Efectivo",
      pagoCon: "100000",
      cambio: 100000 - finalTotal > 0 ? 100000 - finalTotal : undefined,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    setOrders((prev) => [mockOrder, ...prev])
    playAlertSound()
    toast.success(`🔔 ¡Nuevo pedido #${mockOrder.orderNumber} recibido de ${randomName}!`, {
      description: `${quantity}× ${randomProduct.name} — Total: $${finalTotal.toLocaleString()}`,
      duration: 5000,
    })
  }

  const updateCustomer = (id: string, updates: Partial<Customer>) => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    )
    toast.success("Ficha de cliente actualizada")
  }

  const toggleAdminTheme = () => {
    setAdminTheme((prev) => (prev === "light" ? "dark" : "light"))
  }

  const pendingOrdersCount = useMemo(
    () => orders.filter((o) => o.status === "pending").length,
    [orders]
  )

  return (
    <RestaurantContext.Provider
      value={{
        storeConfig,
        updateStoreConfig,
        resetStoreConfig,
        products,
        addProduct,
        updateProduct,
        deleteProduct,
        toggleProductStock,
        additions,
        addAddition,
        updateAddition,
        deleteAddition,
        orders,
        addOrder,
        updateOrderStatus,
        deleteOrder,
        simulateIncomingOrder,
        customers,
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
      }}
    >
      {children}
    </RestaurantContext.Provider>
  )
}

export function useRestaurant() {
  const ctx = useContext(RestaurantContext)
  if (!ctx) {
    throw new Error("useRestaurant must be used within a RestaurantProvider")
  }
  return ctx
}
