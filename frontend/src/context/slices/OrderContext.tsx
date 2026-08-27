import React, { createContext, useContext, useMemo, useCallback, useEffect } from "react"
import type { Order, OrderStatus, Customer } from "@/types/restaurant"
import type { CreateOrderInput, OrderEvent } from "@burger-page/contracts"
import { apiClient } from "@/core/api/apiClient"
import { useTenant } from "./TenantContext"
import { useUi } from "./UiContext"
import { playNotificationChime } from "@/core/audio/soundEffects"
import { toast } from "sonner"

export interface OrderContextType {
  orders: Order[]
  addOrder: (orderData: Omit<Order, "id" | "orderNumber" | "createdAt" | "updatedAt">) => Order
  updateOrderStatus: (orderId: string, newStatus: OrderStatus) => void
  deleteOrder: (orderId: string) => void
  simulateIncomingOrder: () => void
  customers: Customer[]
  updateCustomer: (id: string, updates: Partial<Customer>) => void
  pendingOrdersCount: number
}

const OrderContext = createContext<OrderContextType | undefined>(undefined)

export const OrderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeRestaurant, updateActiveRestaurantRecord } = useTenant()
  const { soundEnabled } = useUi()

  // Real-time SSE order stream subscription
  useEffect(() => {
    const unsubscribe = apiClient.subscribeToOrderStream((event: OrderEvent) => {
      if (!event || !event.orderId) return

      if (event.eventType === "ORDER_STATUS_UPDATED" || event.eventType === "ORDER_CREATED") {
        updateActiveRestaurantRecord((current) => {
          const matchIndex = current.orders.findIndex(
            (o) =>
              o.id === event.orderId ||
              (event.orderNumber !== undefined && o.orderNumber === event.orderNumber)
          )

          if (matchIndex === -1) {
            // New order received via real-time stream
            if (
              event.eventType === "ORDER_CREATED" &&
              event.payload &&
              typeof event.payload === "object"
            ) {
              const p = event.payload as Partial<Order>
              if (p.customer && p.items) {
                const newOrder: Order = {
                  id: event.orderId,
                  orderNumber:
                    event.orderNumber ||
                    p.orderNumber ||
                    Math.floor(10000 + Math.random() * 90000),
                  customer: p.customer,
                  items: p.items,
                  total: p.total || 0,
                  deliveryFee: p.deliveryFee || 0,
                  finalTotal: p.finalTotal || 0,
                  metodo: p.metodo || "Efectivo",
                  pagoCon: p.pagoCon,
                  cambio: p.cambio,
                  comentario: p.comentario,
                  status: (event.status as OrderStatus) || p.status || "pending",
                  createdAt: event.timestamp || new Date().toISOString(),
                  updatedAt: event.timestamp || new Date().toISOString(),
                }
                return {
                  ...current,
                  orders: [newOrder, ...current.orders],
                }
              }
            }
            return current
          }

          return {
            ...current,
            orders: current.orders.map((o, idx) =>
              idx === matchIndex
                ? {
                    ...o,
                    id: event.orderId || o.id,
                    status: (event.status as OrderStatus) || o.status,
                    updatedAt: event.timestamp || new Date().toISOString(),
                  }
                : o
            ),
          }
        })
      }
    })

    return () => {
      unsubscribe()
    }
  }, [updateActiveRestaurantRecord])

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
        const nextCustomers = [...current.customers]
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

      // Backend API Integration with graceful offline fallback
      try {
        const phone = newOrder.customer.telefono.replace(/\D/g, "")
        const existingCustomer = activeRestaurant.customers?.find(
          (c) => c.telefono.replace(/\D/g, "") === phone
        )
        const customerId = existingCustomer ? existingCustomer.id : `cust-${Date.now()}`

        const orderInput: CreateOrderInput = {
          customerId,
          items: newOrder.items.map((item) => {
            const matchedProduct = activeRestaurant.products?.find(
              (p) => p.name.toLowerCase() === item.name.toLowerCase() || p.id === item.id
            )
            return {
              productId: item.id || matchedProduct?.id || item.name,
              quantity: item.cantidad,
              additions: (item.adiciones || []).map((a) => a.name),
            }
          }),
          deliveryFee: newOrder.deliveryFee,
        }

        apiClient
          .createOrder(orderInput)
          .then((createdOrder) => {
            if (createdOrder?.id && createdOrder.id !== newOrder.id) {
              updateActiveRestaurantRecord((current) => ({
                ...current,
                orders: current.orders.map((o) =>
                  o.id === newOrder.id ? { ...o, id: createdOrder.id } : o
                ),
              }))
            }
          })
          .catch((error) => {
            console.warn("Could not sync order to backend API, falling back to local state:", error)
          })
      } catch (err) {
        console.warn("Error preparing order input for backend API:", err)
      }

      return newOrder
    },
    [activeRestaurant, updateActiveRestaurantRecord, soundEnabled]
  )

  const updateOrderStatus = useCallback(
    (orderId: string, newStatus: OrderStatus) => {
      updateActiveRestaurantRecord((current) => ({
        ...current,
        orders: current.orders.map((o) =>
          o.id === orderId
            ? { ...o, status: newStatus, updatedAt: new Date().toISOString() }
            : o
        ),
      }))
      toast.info(`Orden actualizada a: ${newStatus.toUpperCase()}`)

      apiClient.updateOrderStatus(orderId, newStatus).catch((error) => {
        console.warn(`Could not sync status update for order ${orderId} to backend API:`, error)
      })
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
    const randomNames = [
      "Santiago Cruz",
      "Camila Restrepo",
      "Mateo Valencia",
      "Daniela Ospina",
      "Lucas Ramírez",
    ]
    const randomBarrios = [
      "Cedritos",
      "Rosales",
      "Chicó Reservado",
      "Modelia",
      "Teusaquillo",
    ]
    const randomName =
      randomNames[Math.floor(Math.random() * randomNames.length)]
    const randomBarrio =
      randomBarrios[Math.floor(Math.random() * randomBarrios.length)]

    const availableProducts = activeRestaurant.products.filter((p) => p.inStock)
    const product1 =
      availableProducts[Math.floor(Math.random() * availableProducts.length)] ||
      activeRestaurant.products[0]
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
        customers: current.customers.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        ),
      }))
      toast.success("Ficha del cliente actualizada")
    },
    [updateActiveRestaurantRecord]
  )

  const pendingOrdersCount = useMemo(() => {
    return activeRestaurant.orders.filter((o) => o.status === "pending").length
  }, [activeRestaurant.orders])

  const value: OrderContextType = {
    orders: activeRestaurant.orders,
    addOrder,
    updateOrderStatus,
    deleteOrder,
    simulateIncomingOrder,
    customers: activeRestaurant.customers,
    updateCustomer,
    pendingOrdersCount,
  }

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>
}

export const useOrders = (): OrderContextType => {
  const context = useContext(OrderContext)
  if (!context) {
    throw new Error("useOrders must be used within an OrderProvider")
  }
  return context
}
