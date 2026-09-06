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

  it("does not fetch inventory when there is no auth token (guest placeholder tenant)", async () => {
    const { TenantProvider } = await import("./TenantContext")
    const { InventoryProvider, useInventory } = await import("./InventoryContext")
    const { apiClient } = await import("@/core/api/apiClient")

    vi.spyOn(apiClient, "hasToken").mockReturnValue(false)
    const fetchSpy = vi.spyOn(apiClient, "fetchInventory").mockResolvedValue([] as any)

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>
        <InventoryProvider>{children}</InventoryProvider>
      </TenantProvider>
    )

    renderHook(() => useInventory(), { wrapper })

    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(fetchSpy).not.toHaveBeenCalled()
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

    expect(updateStockSpy).toHaveBeenCalledWith(added?.id, -5, "rest-burger-craft")
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

  it("produces distinct ids for two addInventoryItem calls in the same tick (collision regression)", async () => {
    const { TenantProvider } = await import("./TenantContext")
    const { InventoryProvider, useInventory } = await import("./InventoryContext")
    const { apiClient } = await import("@/core/api/apiClient")

    let resolveA!: (value: any) => void
    let resolveB!: (value: any) => void
    vi.spyOn(apiClient, "createInventoryItem")
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveA = resolve
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveB = resolve
          })
      )

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>
        <InventoryProvider>{children}</InventoryProvider>
      </TenantProvider>
    )

    const { result } = renderHook(() => useInventory(), { wrapper })

    vi.useFakeTimers()
    try {
      await act(async () => {
        result.current.addInventoryItem({
          name: "Item Same-tick A",
          category: "ingredients",
          currentStock: 1,
          minStockAlert: 0,
          unit: "kg",
          costPerUnit: 100,
        })
        result.current.addInventoryItem({
          name: "Item Same-tick B",
          category: "ingredients",
          currentStock: 1,
          minStockAlert: 0,
          unit: "kg",
          costPerUnit: 200,
        })
      })
    } finally {
      vi.useRealTimers()
    }

    const itemA = result.current.inventory.find((i) => i.name === "Item Same-tick A")
    const itemB = result.current.inventory.find((i) => i.name === "Item Same-tick B")
    expect(itemA).toBeDefined()
    expect(itemB).toBeDefined()
    // Distinct ids even though both calls happened in the same fake-tick
    expect(itemA!.id).not.toBe(itemB!.id)
    expect(result.current.inventory.length).toBeGreaterThanOrEqual(2)

    // Now resolve backend with distinct ids — each local entry must swap to its OWN id
    await act(async () => {
      resolveA({ id: "server-IA", name: "Item Same-tick A" })
      resolveB({ id: "server-IB", name: "Item Same-tick B" })
      await Promise.resolve()
      await Promise.resolve()
    })

    const swappedA = result.current.inventory.find((i) => i.name === "Item Same-tick A")
    const swappedB = result.current.inventory.find((i) => i.name === "Item Same-tick B")
    expect(swappedA?.id).toBe("server-IA")
    expect(swappedB?.id).toBe("server-IB")
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

    expect(updateStatusSpy).toHaveBeenCalledWith(orderId, "cooking", "rest-burger-craft")
    const updated = result.current.orders.find((o) => o.id === orderId)
    expect(updated?.status).toBe("cooking")
  })

  it("does not fetch orders when there is no auth token (guest placeholder tenant)", async () => {
    const { TenantProvider } = await import("./TenantContext")
    const { OrderProvider, useOrders } = await import("./OrderContext")
    const { UiProvider } = await import("./UiContext")
    const { apiClient } = await import("@/core/api/apiClient")

    vi.spyOn(apiClient, "hasToken").mockReturnValue(false)
    const fetchSpy = vi.spyOn(apiClient, "fetchOrders").mockResolvedValue([] as any)

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>
        <UiProvider>
          <OrderProvider>{children}</OrderProvider>
        </UiProvider>
      </TenantProvider>
    )

    renderHook(() => useOrders(), { wrapper })

    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("subscribes to SSE order stream and updates matching order state on ORDER_STATUS_UPDATED event", async () => {
    const { TenantProvider } = await import("./TenantContext")
    const { OrderProvider, useOrders } = await import("./OrderContext")
    const { apiClient } = await import("@/core/api/apiClient")

    let streamHandler: ((event: any) => void) | null = null
    const unsubscribeSpy = vi.fn()
    vi.spyOn(apiClient, "createOrder").mockResolvedValue({} as any)
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
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
    vi.spyOn(apiClient, "hasToken").mockReturnValue(true)
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

  it("assigns distinct temp ids when two addOrder calls happen in the same tick (same-tick collision regression)", async () => {
    const { TenantProvider } = await import("./TenantContext")
    const { OrderProvider, useOrders } = await import("./OrderContext")
    const { apiClient } = await import("@/core/api/apiClient")

    // Defer backend responses so we can observe the optimistic state before swap
    let resolveA!: (value: any) => void
    let resolveB!: (value: any) => void
    vi.spyOn(apiClient, "createOrder")
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveA = resolve
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveB = resolve
          })
      )

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>
        <UiProvider>
          <OrderProvider>{children}</OrderProvider>
        </UiProvider>
      </TenantProvider>
    )

    const { result } = renderHook(() => useOrders(), { wrapper })

    let firstRefId = ""
    let secondRefId = ""

    // Force same-tick creation: lock the timer so Date.now() returns identical values
    vi.useFakeTimers()
    try {
      await act(async () => {
        const a = result.current.addOrder({
          customer: {
            nombre: "Cliente A",
            telefono: "3111111111",
            direccion: "Calle A",
            barrio: "Norte",
          },
          items: [{ name: "Burger", price: 10000, cantidad: 1, total: 10000 }],
          total: 10000,
          deliveryFee: 0,
          finalTotal: 10000,
          metodo: "Transferencia",
          status: "pending",
        })
        firstRefId = a.id
        const b = result.current.addOrder({
          customer: {
            nombre: "Cliente B",
            telefono: "3222222222",
            direccion: "Calle B",
            barrio: "Sur",
          },
          items: [{ name: "Burger", price: 10000, cantidad: 1, total: 10000 }],
          total: 10000,
          deliveryFee: 0,
          finalTotal: 10000,
          metodo: "Efectivo",
          status: "pending",
        })
        secondRefId = b.id
      })
    } finally {
      vi.useRealTimers()
    }

    // Two distinct addOrder calls must produce two distinct optimistic ids
    expect(firstRefId).not.toBe(secondRefId)
    expect(result.current.orders.length).toBe(2)

    const firstEntry = result.current.orders.find((o) => o.id === firstRefId)
    const secondEntry = result.current.orders.find((o) => o.id === secondRefId)
    expect(firstEntry).toBeDefined()
    expect(secondEntry).toBeDefined()
    expect(firstEntry?.customer.nombre).toBe("Cliente A")
    expect(secondEntry?.customer.nombre).toBe("Cliente B")

    // Now resolve backend with distinct ids — each local entry must swap to its OWN backend id
    await act(async () => {
      resolveA({ id: "server-A", orderNumber: 10180 })
      resolveB({ id: "server-B", orderNumber: 25 })
      // Let pending microtasks settle
      await Promise.resolve()
      await Promise.resolve()
    })

    // Each entry swapped to its OWN backend id (reference-based swap, not id-based)
    const swappedA = result.current.orders.find(
      (o) => o.customer.nombre === "Cliente A"
    )
    const swappedB = result.current.orders.find(
      (o) => o.customer.nombre === "Cliente B"
    )
    expect(swappedA?.id).toBe("server-A")
    expect(swappedB?.id).toBe("server-B")
    // orderNumber propagated from backend response
    expect(swappedA?.orderNumber).toBe(10180)
    expect(swappedB?.orderNumber).toBe(25)
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

  it("supports adding, updating, and deleting product additions with backend API sync", async () => {
    const { TenantProvider } = await import("./TenantContext")
    const { CatalogProvider, useCatalog } = await import("./CatalogContext")
    const { apiClient } = await import("@/core/api/apiClient")

    const createAdditionSpy = vi.spyOn(apiClient, "createAddition").mockResolvedValue({
      id: "add-server-1",
      name: "Tocineta Crujiente",
      price: 3500,
      available: true,
    })
    const updateAdditionSpy = vi.spyOn(apiClient, "updateAddition").mockResolvedValue({
      id: "add-server-1",
      name: "Tocineta Extra Crujiente",
      price: 4000,
      available: false,
    })
    const deleteAdditionSpy = vi.spyOn(apiClient, "deleteAddition").mockResolvedValue(undefined)

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>
        <CatalogProvider>{children}</CatalogProvider>
      </TenantProvider>
    )

    const { result } = renderHook(() => useCatalog(), { wrapper })

    // 1. Add Addition
    await act(async () => {
      result.current.addAddition({
        name: "Tocineta Crujiente",
        price: 3500,
        available: true,
      })
    })

    expect(createAdditionSpy).toHaveBeenCalledWith({
      name: "Tocineta Crujiente",
      price: 3500,
      isAvailable: true,
    })

    // 2. Update Addition
    await act(async () => {
      result.current.updateAddition("add-server-1", {
        name: "Tocineta Extra Crujiente",
        price: 4000,
        available: false,
      })
    })

    expect(updateAdditionSpy).toHaveBeenCalledWith("add-server-1", {
      name: "Tocineta Extra Crujiente",
      price: 4000,
      isAvailable: false,
    })

    // 3. Delete Addition
    await act(async () => {
      result.current.deleteAddition("add-server-1")
    })

    expect(deleteAdditionSpy).toHaveBeenCalledWith("add-server-1")
  })

  it("produces distinct ids for two addProduct calls in the same tick (collision regression)", async () => {
    const { TenantProvider } = await import("./TenantContext")
    const { CatalogProvider, useCatalog } = await import("./CatalogContext")
    const { apiClient } = await import("@/core/api/apiClient")

    let resolveA!: (value: any) => void
    let resolveB!: (value: any) => void
    vi.spyOn(apiClient, "createProduct")
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveA = resolve
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveB = resolve
          })
      )

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>
        <CatalogProvider>{children}</CatalogProvider>
      </TenantProvider>
    )

    const { result } = renderHook(() => useCatalog(), { wrapper })

    vi.useFakeTimers()
    try {
      await act(async () => {
        result.current.addProduct({
          name: "Product Same-tick A",
          price: 100,
          category: "Test",
          src: "",
          description: "",
          inStock: true,
        })
        result.current.addProduct({
          name: "Product Same-tick B",
          price: 200,
          category: "Test",
          src: "",
          description: "",
          inStock: true,
        })
      })
    } finally {
      vi.useRealTimers()
    }

    const prodA = result.current.products.find((p) => p.name === "Product Same-tick A")
    const prodB = result.current.products.find((p) => p.name === "Product Same-tick B")
    expect(prodA).toBeDefined()
    expect(prodB).toBeDefined()
    expect(prodA!.id).not.toBe(prodB!.id)

    await act(async () => {
      resolveA({ id: "server-PA", name: "Product Same-tick A" })
      resolveB({ id: "server-PB", name: "Product Same-tick B" })
      await Promise.resolve()
      await Promise.resolve()
    })

    const swappedA = result.current.products.find(
      (p) => p.name === "Product Same-tick A"
    )
    const swappedB = result.current.products.find(
      (p) => p.name === "Product Same-tick B"
    )
    expect(swappedA?.id).toBe("server-PA")
    expect(swappedB?.id).toBe("server-PB")
  })
})

describe("TenantContext Slice - Same-Tick Restaurant Creation", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it("produces distinct ids for two createRestaurant calls in the same tick (collision regression)", async () => {
    const { TenantProvider, useTenant } = await import("./TenantContext")
    const { apiClient } = await import("@/core/api/apiClient")

    let resolveA!: (value: any) => void
    let resolveB!: (value: any) => void
    vi.spyOn(apiClient, "createRestaurant")
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveA = resolve
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveB = resolve
          })
      )

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TenantProvider>{children}</TenantProvider>
    )

    const { result } = renderHook(() => useTenant(), { wrapper })

    vi.useFakeTimers()
    try {
      await act(async () => {
        result.current.createRestaurant({
          name: "Rest Same-tick A",
          slug: "rest-same-tick-a",
          tagline: "A",
          whatsappNumber: "3000000001",
        })
        result.current.createRestaurant({
          name: "Rest Same-tick B",
          slug: "rest-same-tick-b",
          tagline: "B",
          whatsappNumber: "3000000002",
        })
      })
    } finally {
      vi.useRealTimers()
    }

    const restA = result.current.restaurants.find(
      (r) => r.config.name === "Rest Same-tick A"
    )
    const restB = result.current.restaurants.find(
      (r) => r.config.name === "Rest Same-tick B"
    )
    expect(restA).toBeDefined()
    expect(restB).toBeDefined()
    expect(restA!.id).not.toBe(restB!.id)

    await act(async () => {
      resolveA({ id: "server-RA", slug: "rest-same-tick-a" })
      resolveB({ id: "server-RB", slug: "rest-same-tick-b" })
      await Promise.resolve()
      await Promise.resolve()
    })

    const swappedA = result.current.restaurants.find(
      (r) => r.config.name === "Rest Same-tick A"
    )
    const swappedB = result.current.restaurants.find(
      (r) => r.config.name === "Rest Same-tick B"
    )
    expect(swappedA?.id).toBe("server-RA")
    expect(swappedB?.id).toBe("server-RB")
  })
})



