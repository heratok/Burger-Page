import { describe, it, expect, vi } from "vitest"
import React from "react"
import { renderHook, act } from "@testing-library/react"
import type { RestaurantRecord, Order, Customer } from "@/types/restaurant"
import type { OrderEvent } from "@burger-page/contracts"
import { DEFAULT_STORE_CONFIG } from "@/constants/themePresets"
import { TenantProvider } from "./TenantContext"
import { UiProvider } from "./UiContext"
import {
  mapSseOrderAddition,
  mapSseOrderItem,
  handleOrderDeletedEvent,
  handleOrderReceiptUpdatedEvent,
  handleOrderCreatedEvent,
  handleOrderUpdatedEvent,
  updateRestaurantOrderState,
  syncBackendOrders,
  syncBackendCustomers,
  OrderProvider,
  useOrders,
} from "./OrderContext"

describe("OrderContext Pure Reducers & Updaters (TDD Tests)", () => {
  const createMockRestaurant = (orders: Order[] = [], customers: Customer[] = []): RestaurantRecord => ({
    id: "rest-burger-craft",
    slug: "burger-craft",
    adminPassword: "craft",
    isActive: true,
    createdAt: "2026-08-01T12:00:00.000Z",
    config: DEFAULT_STORE_CONFIG,
    products: [],
    additions: [],
    orders,
    customers,
  })

  const createMockOrder = (id = "order-1", orderNumber = 101): Order => ({
    id,
    orderNumber,
    customer: {
      nombre: "Juan Perez",
      telefono: "3001234567",
      direccion: "Calle 10 # 5-20",
      barrio: "Centro",
    },
    items: [
      {
        id: "item-1",
        name: "Burger Clasica",
        price: 20000,
        cantidad: 1,
        total: 20000,
        adiciones: [{ name: "Tocineta", price: 4000, cantidad: 1 }],
      },
    ],
    total: 20000,
    deliveryFee: 3000,
    finalTotal: 23000,
    metodo: "Efectivo",
    status: "pending",
    createdAt: "2026-08-01T14:00:00.000Z",
    updatedAt: "2026-08-01T14:00:00.000Z",
  })

  describe("mapSseOrderAddition", () => {
    it("maps raw SSE addition with defaults when fields are missing", () => {
      const res = mapSseOrderAddition({})
      expect(res.name).toBe("Adición")
      expect(res.price).toBe(0)
      expect(res.cantidad).toBe(1)
    })

    it("maps addition with explicit name, price, and quantity", () => {
      const res = mapSseOrderAddition({ additionName: "Queso Cheddar", unitPrice: 3500, quantity: 2 })
      expect(res.name).toBe("Queso Cheddar")
      expect(res.price).toBe(3500)
      expect(res.cantidad).toBe(2)
    })
  })

  describe("mapSseOrderItem", () => {
    it("maps item and calculates line total", () => {
      const res = mapSseOrderItem({
        id: "item-10",
        productName: "Doble Carne",
        unitPrice: 25000,
        quantity: 2,
        observation: "Sin salsas",
        additions: [{ additionName: "Tocineta", unitPrice: 4000, quantity: 1 }],
      })

      expect(res.name).toBe("Doble Carne")
      expect(res.price).toBe(25000)
      expect(res.cantidad).toBe(2)
      expect(res.total).toBe(50000)
      expect(res.observacion).toBe("Sin salsas")
      expect(res.adiciones).toHaveLength(1)
      expect(res.adiciones[0].name).toBe("Tocineta")
    })
  })

  describe("handleOrderDeletedEvent", () => {
    it("removes the deleted order from current restaurant record", () => {
      const initial = createMockRestaurant([createMockOrder("order-1"), createMockOrder("order-2")])
      const updated = handleOrderDeletedEvent(initial, "order-1")

      expect(updated.orders).toHaveLength(1)
      expect(updated.orders[0].id).toBe("order-2")
    })
  })

  describe("handleOrderReceiptUpdatedEvent", () => {
    it("updates receiptUrl and updatedAt for target order", () => {
      const initial = createMockRestaurant([createMockOrder("order-1")])
      const event: OrderEvent = {
        eventType: "ORDER_RECEIPT_UPDATED",
        orderId: "order-1",
        payload: { receiptUrl: "https://bucket.com/receipt.png" },
        timestamp: "2026-08-01T15:00:00.000Z",
      }

      const updated = handleOrderReceiptUpdatedEvent(initial, event)
      expect(updated.orders[0].receiptUrl).toBe("https://bucket.com/receipt.png")
      expect(updated.orders[0].updatedAt).toBe("2026-08-01T15:00:00.000Z")
    })
  })

  describe("handleOrderCreatedEvent", () => {
    it("ignores event if payload is missing or invalid", () => {
      const initial = createMockRestaurant()
      const event: any = { eventType: "ORDER_CREATED", orderId: "order-99", payload: null }
      const res = handleOrderCreatedEvent(initial, event)
      expect(res).toBe(initial)
    })

    it("prepends new order to orders list with mapped fields", () => {
      const initial = createMockRestaurant([createMockOrder("order-existing")])
      const event: OrderEvent = {
        eventType: "ORDER_CREATED",
        orderId: "order-new",
        orderNumber: 202,
        status: "pending",
        timestamp: "2026-08-01T16:00:00.000Z",
        payload: {
          customer: { nombre: "Maria Gomez", telefono: "3112223344", direccion: "Cra 7", barrio: "Norte" },
          items: [{ productName: "Papas", unitPrice: 10000, quantity: 1 }],
          subtotal: 10000,
          deliveryFee: 2000,
          finalTotal: 12000,
          paymentMethod: "Transferencia",
        },
      }

      const updated = handleOrderCreatedEvent(initial, event)
      expect(updated.orders).toHaveLength(2)
      expect(updated.orders[0].id).toBe("order-new")
      expect(updated.orders[0].orderNumber).toBe(202)
      expect(updated.orders[0].status).toBe("pending")
      expect(updated.orders[0].customer.nombre).toBe("Maria Gomez")
      expect(updated.orders[0].finalTotal).toBe(12000)
    })
  })

  describe("handleOrderUpdatedEvent", () => {
    it("updates matching order in list with updated domain fields", () => {
      const initial = createMockRestaurant([createMockOrder("order-1")])
      const event: OrderEvent = {
        eventType: "ORDER_UPDATED",
        orderId: "order-1",
        status: "cooking",
        timestamp: "2026-08-01T16:30:00.000Z",
        payload: {
          status: "cooking",
          comment: "Añadir servilletas extras",
        },
      }

      const updated = handleOrderUpdatedEvent(initial, event, 0)
      expect(updated.orders[0].status).toBe("cooking")
      expect(updated.orders[0].comentario).toBe("Añadir servilletas extras")
      expect(updated.orders[0].updatedAt).toBe("2026-08-01T16:30:00.000Z")
    })
  })

  describe("updateRestaurantOrderState", () => {
    it("routes ORDER_DELETED properly", () => {
      const initial = createMockRestaurant([createMockOrder("order-1")])
      const res = updateRestaurantOrderState(initial, {
        eventType: "ORDER_DELETED",
        orderId: "order-1",
        timestamp: "2026-08-01T16:35:00.000Z",
      })
      expect(res.orders).toHaveLength(0)
    })

    it("routes ORDER_RECEIPT_UPDATED properly", () => {
      const initial = createMockRestaurant([createMockOrder("order-1")])
      const res = updateRestaurantOrderState(initial, {
        eventType: "ORDER_RECEIPT_UPDATED",
        orderId: "order-1",
        timestamp: "2026-08-01T16:35:00.000Z",
        payload: { receiptUrl: "https://image.png" },
      })
      expect(res.orders[0].receiptUrl).toBe("https://image.png")
    })

    it("routes ORDER_CREATED when order does not exist in state", () => {
      const initial = createMockRestaurant([])
      const res = updateRestaurantOrderState(initial, {
        eventType: "ORDER_CREATED",
        orderId: "order-fresh",
        timestamp: "2026-08-01T16:35:00.000Z",
        payload: {
          customer: { nombre: "Nuevo" },
          items: [],
          total: 15000,
        },
      })
      expect(res.orders).toHaveLength(1)
      expect(res.orders[0].id).toBe("order-fresh")
    })

    it("returns current record unchanged for unknown event type", () => {
      const initial = createMockRestaurant()
      const res = updateRestaurantOrderState(initial, {
        eventType: "UNKNOWN_EVENT" as any,
        orderId: "order-1",
        timestamp: "2026-08-01T16:35:00.000Z",
      })
      expect(res).toBe(initial)
    })
  })

  describe("syncBackendOrders", () => {
    it("synchronizes backend orders as authoritative source of truth, removing stale local orders", () => {
      const currentOrders = [
        createMockOrder("ord-1"),
      ]
      const backendOrders = [
        {
          id: "ord-2",
          orderNumber: 102,
          subtotal: 30000,
          deliveryFee: 4000,
          finalTotal: 34000,
          status: "confirmed",
          createdAt: "2026-08-02T10:00:00.000Z",
          customer: { name: "Andres", phone: "3123456789" },
        },
      ]

      const synced = syncBackendOrders(currentOrders, backendOrders, [])
      expect(synced).toHaveLength(1)
      expect(synced[0].id).toBe("ord-2")
    })

    it("returns empty array when backend has 0 orders, purging ghost orders from local state", () => {
      const currentOrders = [
        createMockOrder("ord-ghost-1"),
        createMockOrder("ord-ghost-2"),
      ]
      const synced = syncBackendOrders(currentOrders, [], [])
      expect(synced).toHaveLength(0)
    })

    it("falls back to currentOrders when backendOrders is not an array", () => {
      const currentOrders = [createMockOrder("ord-1")]
      const synced = syncBackendOrders(currentOrders, null as any, [])
      expect(synced).toEqual(currentOrders)
    })
  })

  describe("syncBackendCustomers", () => {
    it("merges backend customers with existing customers map and dedupes by cleaned phone", () => {
      const currentCustomers: Customer[] = [
        {
          id: "cust-1",
          nombre: "Laura Medina",
          telefono: "+57 310 987 6543",
          direccion: "Calle 100",
          barrio: "Chico",
          totalOrders: 1,
          totalSpent: 25000,
          lastOrderDate: "2026-08-01T12:00:00.000Z",
          loyaltyTier: "bronze",
        },
      ]

      const backendCustomers = [
        {
          id: "cust-1",
          name: "Laura Medina Updated",
          phone: "3109876543",
          address: "Calle 100 # 15-20",
          barrio: "Chico Norte",
        },
        {
          id: "cust-2",
          name: "Nuevo Cliente",
          phone: "3001112233",
          address: "Carrera 7 # 45",
          barrio: "Chapinero",
        },
      ]

      const synced = syncBackendCustomers(currentCustomers, backendCustomers, [])
      expect(synced).toHaveLength(2)
      const updatedCust1 = synced.find((c) => c.id === "cust-1")
      expect(updatedCust1?.nombre).toBe("Laura Medina Updated")
      expect(updatedCust1?.direccion).toBe("Calle 100 # 15-20")

      const newCust2 = synced.find((c) => c.id === "cust-2")
      expect(newCust2?.nombre).toBe("Nuevo Cliente")
      expect(newCust2?.loyaltyTier).toBe("bronze")
    })

    it("skips items with empty or null ID", () => {
      const synced = syncBackendCustomers([], [null, {}, { id: "" }], [])
      expect(synced).toHaveLength(0)
    })

    it("computes loyalty tiers based on order history in nextOrders", () => {
      const mockOrders: Order[] = [
        {
          ...createMockOrder("ord-vip", 901),
          customer: { nombre: "VIP User", telefono: "3000000001", direccion: "", barrio: "" },
          finalTotal: 450000,
        },
        {
          ...createMockOrder("ord-gold", 902),
          customer: { nombre: "Gold User", telefono: "3000000002", direccion: "", barrio: "" },
          finalTotal: 260000,
        },
        {
          ...createMockOrder("ord-silver", 903),
          customer: { nombre: "Silver User", telefono: "3000000003", direccion: "", barrio: "" },
          finalTotal: 120000,
        },
      ]

      const backendCustomers = [
        { id: "bc-vip", name: "VIP User", phone: "3000000001" },
        { id: "bc-gold", name: "Gold User", phone: "3000000002" },
        { id: "bc-silver", name: "Silver User", phone: "3000000003" },
      ]

      const synced = syncBackendCustomers([], backendCustomers, mockOrders)
      expect(synced.find((c) => c.id === "bc-vip")?.loyaltyTier).toBe("vip")
      expect(synced.find((c) => c.id === "bc-gold")?.loyaltyTier).toBe("gold")
      expect(synced.find((c) => c.id === "bc-silver")?.loyaltyTier).toBe("silver")
    })

    it("matches order customer with existing customer record in syncBackendOrders", () => {
      const currentCustomers: Customer[] = [
        {
          id: "cust-target",
          nombre: "Target Customer",
          telefono: "3005554433",
          direccion: "Av 10",
          barrio: "Chapinero",
          totalOrders: 1,
          totalSpent: 20000,
          lastOrderDate: "2026-08-01T12:00:00.000Z",
          loyaltyTier: "bronze",
        },
      ]

      const backendOrders = [
        {
          id: "ord-matched",
          orderNumber: 505,
          customerId: "cust-target",
          subtotal: 20000,
          deliveryFee: 0,
          finalTotal: 20000,
          status: "pending",
          createdAt: "2026-08-01T12:00:00.000Z",
        },
      ]

      const synced = syncBackendOrders([], backendOrders, currentCustomers)
      expect(synced[0].customer.nombre).toBe("Target Customer")
      expect(synced[0].customer.direccion).toBe("Av 10")
    })

    it("returns current state when order is not found for status update event", () => {
      const initial = createMockRestaurant([])
      const res = updateRestaurantOrderState(initial, {
        eventType: "ORDER_STATUS_UPDATED",
        orderId: "non-existent-order",
        timestamp: "2026-08-01T12:00:00.000Z",
      })
      expect(res).toBe(initial)
    })

    it("refreshOrders invokes apiClient.fetchOrders and updates orders state from backend", async () => {
      const { apiClient } = await import("@/core/api/apiClient")
      const fetchSpy = vi.spyOn(apiClient, "fetchOrders").mockResolvedValue([
        {
          id: "ord-refreshed",
          orderNumber: 999,
          status: "cooking",
          subtotal: 15000,
          deliveryFee: 2000,
          finalTotal: 17000,
          createdAt: new Date().toISOString(),
          customer: { name: "Refresh Customer" },
        } as any,
      ])
      vi.spyOn(apiClient, "fetchCustomers").mockResolvedValue([])
      vi.spyOn(apiClient, "hasToken").mockReturnValue(true)

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TenantProvider>
          <UiProvider>
            <OrderProvider>{children}</OrderProvider>
          </UiProvider>
        </TenantProvider>
      )

      const { result } = renderHook(() => useOrders(), { wrapper })

      await act(async () => {
        await result.current.refreshOrders()
      })

      expect(fetchSpy).toHaveBeenCalled()
      expect(result.current.orders.some((o) => o.id === "ord-refreshed")).toBe(true)
    })
  })
})
