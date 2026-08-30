import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import React from "react"
import { UiProvider, useUi } from "./UiContext"
import { AuthProvider, useAuth } from "./AuthContext"
import type { RestaurantRecord } from "@/types/restaurant"
import { DEFAULT_STORE_CONFIG } from "@/constants/themePresets"

const mockRestaurants: RestaurantRecord[] = [
  {
    id: "rest-burger-craft",
    slug: "burger-craft",
    adminPassword: "craft",
    isActive: true,
    createdAt: "2026-08-01T12:00:00.000Z",
    config: DEFAULT_STORE_CONFIG,
    products: [],
    additions: [],
    orders: [],
    customers: [],
  },
]

describe("UiContext Slice", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <UiProvider>{children}</UiProvider>
  )

  it("toggles admin theme between light and dark", () => {
    const { result } = renderHook(() => useUi(), { wrapper })
    expect(result.current.adminTheme).toBe("dark")

    act(() => {
      result.current.toggleAdminTheme()
    })
    expect(result.current.adminTheme).toBe("light")

    act(() => {
      result.current.toggleAdminTheme()
    })
    expect(result.current.adminTheme).toBe("dark")
  })

  it("updates sound enabled setting", () => {
    const { result } = renderHook(() => useUi(), { wrapper })
    expect(result.current.soundEnabled).toBe(true)

    act(() => {
      result.current.setSoundEnabled(false)
    })
    expect(result.current.soundEnabled).toBe(false)
  })
})

describe("AuthContext Slice", () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  )

  it("rejects invalid passwords", () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    act(() => {
      const response = result.current.login("wrong-password", mockRestaurants)
      expect(response.success).toBe(false)
    })
    expect(result.current.session.role).toBe("guest")
  })

  it("logs out and resets session to guest", () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    act(() => {
      result.current.login("admin", mockRestaurants)
    })
    expect(result.current.session.role).toBe("super")

    act(() => {
      result.current.logout()
    })
    expect(result.current.session.role).toBe("guest")
  })
})

describe("InventoryContext Slice", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it("manages inventory items and calculates stock value and alerts", async () => {
    const { TenantProvider } = await import("./TenantContext")
    const { InventoryProvider, useInventory } = await import("./InventoryContext")

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>
        <InventoryProvider>{children}</InventoryProvider>
      </TenantProvider>
    )

    const { result } = renderHook(() => useInventory(), { wrapper })

    expect(Array.isArray(result.current.inventory)).toBe(true)
    expect(Array.isArray(result.current.suppliers)).toBe(true)

    // Add new inventory item
    act(() => {
      result.current.addInventoryItem({
        name: "Queso Mozzarella Bloque 1kg",
        category: "ingredients",
        currentStock: 10,
        minStockAlert: 3,
        unit: "kg",
        costPerUnit: 18000,
      })
    })

    const added = result.current.inventory.find((i) => i.name === "Queso Mozzarella Bloque 1kg")
    expect(added).toBeDefined()
    expect(added?.currentStock).toBe(10)

    // Adjust stock
    act(() => {
      if (added) {
        result.current.adjustStock(added.id, -8)
      }
    })

    const updated = result.current.inventory.find((i) => i.name === "Queso Mozzarella Bloque 1kg")
    expect(updated?.currentStock).toBe(2)
    // 2 <= 3 (minStockAlert), so it triggers low stock alert
    expect(result.current.lowStockCount).toBeGreaterThan(0)
  })

  it("calls apiClient.updateInventoryStock when adjustStock is called", async () => {
    const { TenantProvider } = await import("./TenantContext")
    const { InventoryProvider, useInventory } = await import("./InventoryContext")
    const { apiClient } = await import("@/core/api/apiClient")

    const updateStockSpy = vi.spyOn(apiClient, "updateInventoryStock").mockResolvedValue({} as any)

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>
        <InventoryProvider>{children}</InventoryProvider>
      </TenantProvider>
    )

    const { result } = renderHook(() => useInventory(), { wrapper })

    act(() => {
      result.current.addInventoryItem({
        name: "Pan Brioche",
        category: "ingredients",
        currentStock: 50,
        minStockAlert: 10,
        unit: "unidades",
        costPerUnit: 1200,
      })
    })

    const added = result.current.inventory.find((i) => i.name === "Pan Brioche")
    expect(added).toBeDefined()

    act(() => {
      if (added) {
        result.current.adjustStock(added.id, -5)
      }
    })

    expect(updateStockSpy).toHaveBeenCalledWith(added?.id, -5)
    const updated = result.current.inventory.find((i) => i.name === "Pan Brioche")
    expect(updated?.currentStock).toBe(45)
  })

  it("handles apiClient.updateInventoryStock network errors gracefully without crashing", async () => {
    const { TenantProvider } = await import("./TenantContext")
    const { InventoryProvider, useInventory } = await import("./InventoryContext")
    const { apiClient } = await import("@/core/api/apiClient")

    vi.spyOn(apiClient, "updateInventoryStock").mockRejectedValue(new Error("Network Error: 500"))

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>
        <InventoryProvider>{children}</InventoryProvider>
      </TenantProvider>
    )

    const { result } = renderHook(() => useInventory(), { wrapper })

    act(() => {
      result.current.addInventoryItem({
        name: "Carne Angus 150g",
        category: "ingredients",
        currentStock: 20,
        minStockAlert: 5,
        unit: "unidades",
        costPerUnit: 6000,
      })
    })

    const added = result.current.inventory.find((i) => i.name === "Carne Angus 150g")
    expect(added).toBeDefined()

    expect(() => {
      act(() => {
        if (added) {
          result.current.adjustStock(added.id, 10)
        }
      })
    }).not.toThrow()

    const updated = result.current.inventory.find((i) => i.name === "Carne Angus 150g")
    expect(updated?.currentStock).toBe(30)
  })
})

describe("OrderContext Slice", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it("calls apiClient.createOrder with mapped CreateOrderInput when addOrder is called", async () => {
    const { TenantProvider } = await import("./TenantContext")
    const { OrderProvider, useOrders } = await import("./OrderContext")
    const { apiClient } = await import("@/core/api/apiClient")

    const createOrderSpy = vi.spyOn(apiClient, "createOrder").mockResolvedValue({
      id: "server-order-123",
    } as any)

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>
        <UiProvider>
          <OrderProvider>{children}</OrderProvider>
        </UiProvider>
      </TenantProvider>
    )

    const { result } = renderHook(() => useOrders(), { wrapper })

    act(() => {
      result.current.addOrder({
        customer: {
          nombre: "Laura Medina",
          telefono: "3109876543",
          direccion: "Cra 15 # 85-30",
          barrio: "Antiguo Country",
        },
        items: [
          {
            id: "prod-1",
            name: "Classic Cheese Burger",
            price: 25000,
            cantidad: 2,
            total: 50000,
            adiciones: [{ name: "Tocineta", price: 4000, cantidad: 1 }],
          },
        ],
        total: 50000,
        deliveryFee: 4000,
        finalTotal: 54000,
        metodo: "Transferencia",
        status: "pending",
      })
    })

    expect(createOrderSpy).toHaveBeenCalledTimes(1)
    expect(createOrderSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          {
            productId: "prod-1",
            quantity: 2,
            additions: ["Tocineta"],
          },
        ],
        deliveryFee: 4000,
      })
    )
    expect(result.current.orders.length).toBeGreaterThan(0)
  })

  it("handles apiClient.createOrder network errors gracefully without crashing", async () => {
    const { TenantProvider } = await import("./TenantContext")
    const { OrderProvider, useOrders } = await import("./OrderContext")
    const { apiClient } = await import("@/core/api/apiClient")

    vi.spyOn(apiClient, "createOrder").mockRejectedValue(new Error("Network Error: 500"))

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>
        <UiProvider>
          <OrderProvider>{children}</OrderProvider>
        </UiProvider>
      </TenantProvider>
    )

    const { result } = renderHook(() => useOrders(), { wrapper })

    let addedOrder: any
    expect(() => {
      act(() => {
        addedOrder = result.current.addOrder({
          customer: {
            nombre: "Carlos Vives",
            telefono: "3000000000",
            direccion: "Calle 1",
            barrio: "Centro",
          },
          items: [
            {
              name: "Burger",
              price: 20000,
              cantidad: 1,
              total: 20000,
            },
          ],
          total: 20000,
          deliveryFee: 3000,
          finalTotal: 23000,
          metodo: "Efectivo",
          status: "pending",
        })
      })
    }).not.toThrow()

    expect(addedOrder).toBeDefined()
    expect(result.current.orders.some((o) => o.customer.nombre === "Carlos Vives")).toBe(true)
  })

  it("calls apiClient.updateOrderStatus when updateOrderStatus is called", async () => {
    const { TenantProvider } = await import("./TenantContext")
    const { OrderProvider, useOrders } = await import("./OrderContext")
    const { apiClient } = await import("@/core/api/apiClient")

    vi.spyOn(apiClient, "createOrder").mockResolvedValue({} as any)
    const updateStatusSpy = vi.spyOn(apiClient, "updateOrderStatus").mockResolvedValue({} as any)

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>
        <UiProvider>
          <OrderProvider>{children}</OrderProvider>
        </UiProvider>
      </TenantProvider>
    )

    const { result } = renderHook(() => useOrders(), { wrapper })

    let orderId = ""
    act(() => {
      const o = result.current.addOrder({
        customer: {
          nombre: "Andrés",
          telefono: "3111111111",
          direccion: "Calle 2",
          barrio: "Norte",
        },
        items: [
          {
            name: "Burger",
            price: 15000,
            cantidad: 1,
            total: 15000,
          },
        ],
        total: 15000,
        deliveryFee: 0,
        finalTotal: 15000,
        metodo: "Efectivo",
        status: "pending",
      })
      orderId = o.id
    })

    act(() => {
      result.current.updateOrderStatus(orderId, "cooking")
    })

    expect(updateStatusSpy).toHaveBeenCalledWith(orderId, "cooking")
    const updated = result.current.orders.find((o) => o.id === orderId)
    expect(updated?.status).toBe("cooking")
  })

  it("subscribes to SSE order stream and updates matching order state on ORDER_STATUS_UPDATED event", async () => {
    const { TenantProvider } = await import("./TenantContext")
    const { OrderProvider, useOrders } = await import("./OrderContext")
    const { apiClient } = await import("@/core/api/apiClient")

    let streamHandler: ((event: any) => void) | null = null
    const unsubscribeSpy = vi.fn()
    vi.spyOn(apiClient, "createOrder").mockResolvedValue({} as any)
    vi.spyOn(apiClient, "subscribeToOrderStream").mockImplementation((onEvent) => {
      streamHandler = onEvent
      return unsubscribeSpy
    })

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>
        <UiProvider>
          <OrderProvider>{children}</OrderProvider>
        </UiProvider>
      </TenantProvider>
    )

    const { result, unmount } = renderHook(() => useOrders(), { wrapper })

    expect(streamHandler).not.toBeNull()

    let orderId = ""
    act(() => {
      const o = result.current.addOrder({
        customer: {
          nombre: "Sofia Vergara",
          telefono: "3151234567",
          direccion: "Calle 100 # 20",
          barrio: "Usaquén",
        },
        items: [
          {
            name: "Salchipapa",
            price: 18000,
            cantidad: 1,
            total: 18000,
          },
        ],
        total: 18000,
        deliveryFee: 4000,
        finalTotal: 22000,
        metodo: "Transferencia",
        status: "pending",
      })
      orderId = o.id
    })

    // Dispatch real-time ORDER_STATUS_UPDATED
    act(() => {
      streamHandler?.({
        eventType: "ORDER_STATUS_UPDATED",
        orderId,
        status: "delivering",
        timestamp: new Date().toISOString(),
      })
    })

    const matched = result.current.orders.find((o) => o.id === orderId)
    expect(matched?.status).toBe("delivering")

    // Unmount and verify cleanup
    unmount()
    expect(unsubscribeSpy).toHaveBeenCalled()
  })

  it("adds new order to state when SSE stream receives ORDER_CREATED event with payload", async () => {
    const { TenantProvider } = await import("./TenantContext")
    const { OrderProvider, useOrders } = await import("./OrderContext")
    const { apiClient } = await import("@/core/api/apiClient")

    let streamHandler: ((event: any) => void) | null = null
    vi.spyOn(apiClient, "subscribeToOrderStream").mockImplementation((onEvent) => {
      streamHandler = onEvent
      return vi.fn()
    })

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>
        <UiProvider>
          <OrderProvider>{children}</OrderProvider>
        </UiProvider>
      </TenantProvider>
    )

    const { result } = renderHook(() => useOrders(), { wrapper })

    act(() => {
      streamHandler?.({
        eventType: "ORDER_CREATED",
        orderId: "ord-live-999",
        orderNumber: 99999,
        status: "pending",
        timestamp: new Date().toISOString(),
        payload: {
          customer: {
            nombre: "Mariana Pajón",
            telefono: "3123456789",
            direccion: "Pista BMX # 1",
            barrio: "Belén",
          },
          items: [
            {
              name: "Hamburguesa Campeona",
              price: 30000,
              cantidad: 1,
              total: 30000,
            },
          ],
          total: 30000,
          deliveryFee: 5000,
          finalTotal: 35000,
        },
      })
    })

    const newOrder = result.current.orders.find((o) => o.id === "ord-live-999")
    expect(newOrder).toBeDefined()
    expect(newOrder?.customer.nombre).toBe("Mariana Pajón")
    expect(newOrder?.status).toBe("pending")
  })
})

describe("CatalogContext Slice - Dynamic Category Management", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it("supports adding, updating/renaming, and deleting categories with product cascade", async () => {
    const { TenantProvider } = await import("./TenantContext")
    const { CatalogProvider, useCatalog } = await import("./CatalogContext")
    const { apiClient } = await import("@/core/api/apiClient")

    const updateCategoriesSpy = vi.spyOn(apiClient, "updateCategories").mockResolvedValue({
      categories: ["Especiales", "Pollo", "Gourmet", "Clásicas", "Entradas"],
    })

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>
        <CatalogProvider>{children}</CatalogProvider>
      </TenantProvider>
    )

    const { result } = renderHook(() => useCatalog(), { wrapper })

    // 1. Add Category
    act(() => {
      result.current.addCategory("Entradas")
    })

    expect(result.current.categories).toContain("Entradas")
    expect(updateCategoriesSpy).toHaveBeenCalledWith(
      expect.arrayContaining(["Entradas"]),
      expect.any(String)
    )

    // Add a product in this category
    act(() => {
      result.current.addProduct({
        name: "Aros de Cebolla",
        price: 12000,
        category: "Entradas",
        src: "",
        description: "Crujientes",
        inStock: true,
      })
    })

    const onionRings = result.current.products.find((p) => p.name === "Aros de Cebolla")
    expect(onionRings?.category).toBe("Entradas")

    // 2. Rename Category -> Should cascade to product
    act(() => {
      result.current.updateCategory("Entradas", "Aperitivos")
    })

    expect(result.current.categories).toContain("Aperitivos")
    expect(result.current.categories).not.toContain("Entradas")

    const updatedOnionRings = result.current.products.find((p) => p.name === "Aros de Cebolla")
    expect(updatedOnionRings?.category).toBe("Aperitivos")

    // 3. Delete Category -> Should reassign product to fallback category
    act(() => {
      result.current.deleteCategory("Aperitivos")
    })

    expect(result.current.categories).not.toContain("Aperitivos")
    const reassignedProduct = result.current.products.find((p) => p.name === "Aros de Cebolla")
    expect(reassignedProduct?.category).not.toBe("Aperitivos")
    expect(result.current.categories).toContain(reassignedProduct?.category)
  })
})


