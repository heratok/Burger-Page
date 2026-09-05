import React, { createContext, useContext, useMemo, useCallback, useEffect } from "react"
import type { Order, OrderStatus, Customer } from "@/types/restaurant"
import type { CreateOrderInput, OrderEvent } from "@burger-page/contracts"
import { apiClient } from "@/core/api/apiClient"
import { useTenant } from "./TenantContext"
import { useUi } from "./UiContext"
import { playNotificationChime } from "@/core/audio/soundEffects"
import { toast } from "sonner"
import { formatCurrency, cleanPhoneNumber } from "@/lib/utils"

export interface OrderContextType {
  orders: Order[]
  addOrder: (orderData: Omit<Order, "id" | "orderNumber" | "createdAt" | "updatedAt">) => Order
  updateOrderStatus: (orderId: string, newStatus: OrderStatus) => void
  updateOrderReceipt: (orderId: string, receiptUrl: string) => Promise<void>
  deleteOrder: (orderId: string) => void
  customers: Customer[]
  updateCustomer: (id: string, updates: Partial<Customer>) => void
  pendingOrdersCount: number
}

const OrderContext = createContext<OrderContextType | undefined>(undefined)

export const OrderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeRestaurant, updateActiveRestaurantRecord } = useTenant()
  const { soundEnabled } = useUi()

  // Hydrate orders from database
  useEffect(() => {
    if (!activeRestaurant?.id || !apiClient.hasToken()) return
    apiClient
      .fetchOrders(activeRestaurant.id)
      .then((backendOrders) => {
        if (Array.isArray(backendOrders) && backendOrders.length > 0) {
          updateActiveRestaurantRecord((current) => {
            const map = new Map<string, Order>()
            current.orders.forEach((o) => map.set(o.id, o))
            backendOrders.forEach((bo: any) => {
              if (bo && bo.id) {
                const existing = map.get(bo.id)
                const matchedCustomer = current.customers.find((c) => c.id === bo.customerId)
                const customer =
                  existing?.customer ||
                  bo.customer ||
                  (matchedCustomer
                    ? {
                        nombre: matchedCustomer.nombre,
                        telefono: matchedCustomer.telefono,
                        direccion: matchedCustomer.direccion,
                        barrio: matchedCustomer.barrio,
                      }
                    : {
                        nombre: 'Cliente',
                        telefono: '',
                        direccion: '',
                        barrio: '',
                      })
                const mappedOrder: Order = {
                  id: bo.id,
                  orderNumber: bo.orderNumber || existing?.orderNumber || 0,
                  customer,
                  items: (bo.items || existing?.items || []).map((item: any) => ({
                    id: item.id,
                    name: item.productName || item.name || 'Producto',
                    price: Number(item.unitPrice ?? item.price ?? 0),
                    cantidad: Number(item.quantity ?? item.cantidad ?? 1),
                    total: Number(item.unitPrice ?? item.price ?? 0) * Number(item.quantity ?? item.cantidad ?? 1),
                    observacion: item.observation || item.observacion,
                    adiciones: (item.additions || item.adiciones || []).map((a: any) => ({
                      name: a.additionName || a.name || 'Adición',
                      price: Number(a.unitPrice ?? a.price ?? 0),
                      cantidad: Number(a.quantity ?? 1),
                    })),
                  })),
                  total: Number(bo.subtotal ?? bo.total ?? existing?.total ?? 0),
                  deliveryFee: Number(bo.deliveryFee ?? existing?.deliveryFee ?? 0),
                  finalTotal: Number(bo.finalTotal ?? bo.total ?? existing?.finalTotal ?? 0),
                  metodo: (bo.paymentMethod || bo.metodo || 'Efectivo') as any,
                  pagoCon: bo.paymentAmount ? String(bo.paymentAmount) : bo.pagoCon,
                  cambio: bo.changeAmount !== undefined ? Number(bo.changeAmount) : bo.cambio,
                  comentario: bo.comment || bo.comentario,
                  receiptUrl: bo.receiptUrl || existing?.receiptUrl,
                  status: (bo.status as OrderStatus) || existing?.status || 'pending',
                  createdAt: bo.createdAt || existing?.createdAt || new Date().toISOString(),
                  updatedAt: bo.updatedAt || existing?.updatedAt || new Date().toISOString(),
                }
                map.set(bo.id, mappedOrder)
              }
            })
            return {
              ...current,
              orders: Array.from(map.values()).sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              ),
            }
          })
        }
      })
      .catch((err) => {
        if (import.meta.env?.MODE !== 'test') {
          console.warn("Could not fetch orders from backend API:", err)
        }
      })
  }, [activeRestaurant?.id, updateActiveRestaurantRecord])

  // Real-time SSE order stream subscription
  useEffect(() => {
    if (!apiClient.hasToken()) return
    const unsubscribe = apiClient.subscribeToOrderStream((event: OrderEvent) => {
      if (!event || !event.orderId) return

      if (event.eventType === "ORDER_RECEIPT_UPDATED") {
        const payloadReceipt = (event.payload as any)?.receiptUrl
        updateActiveRestaurantRecord((current) => ({
          ...current,
          orders: current.orders.map((o) =>
            o.id === event.orderId
              ? {
                  ...o,
                  receiptUrl: payloadReceipt || o.receiptUrl,
                  updatedAt: event.timestamp || new Date().toISOString(),
                }
              : o
          ),
        }))
        return
      }

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
              const p = event.payload as any
              const customer = p.customer || {
                nombre: 'Cliente',
                telefono: '',
                direccion: '',
                barrio: '',
              }
              const newOrder: Order = {
                id: event.orderId,
                orderNumber:
                  event.orderNumber ||
                  p.orderNumber ||
                  Math.floor(10000 + Math.random() * 90000),
                customer,
                items: (p.items || []).map((item: any) => ({
                  id: item.id,
                  name: item.productName || item.name || 'Producto',
                  price: Number(item.unitPrice ?? item.price ?? 0),
                  cantidad: Number(item.quantity ?? item.cantidad ?? 1),
                  total: Number(item.unitPrice ?? item.price ?? 0) * Number(item.quantity ?? item.cantidad ?? 1),
                  observacion: item.observation || item.observacion,
                  adiciones: (item.additions || item.adiciones || []).map((a: any) => ({
                    name: a.additionName || a.name || 'Adición',
                    price: Number(a.unitPrice ?? a.price ?? 0),
                    cantidad: Number(a.quantity ?? 1),
                  })),
                })),
                total: Number(p.subtotal ?? p.total ?? 0),
                deliveryFee: Number(p.deliveryFee ?? 0),
                finalTotal: Number(p.finalTotal ?? p.total ?? 0),
                metodo: p.paymentMethod || p.metodo || "Efectivo",
                pagoCon: p.paymentAmount ? String(p.paymentAmount) : p.pagoCon,
                cambio: p.changeAmount !== undefined ? Number(p.changeAmount) : p.cambio,
                comentario: p.comment || p.comentario,
                receiptUrl: p.receiptUrl,
                status: (event.status as OrderStatus) || p.status || "pending",
                createdAt: event.timestamp || new Date().toISOString(),
                updatedAt: event.timestamp || new Date().toISOString(),
              }
              return {
                ...current,
                orders: [newOrder, ...current.orders],
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
                    receiptUrl: (event.payload as any)?.receiptUrl || o.receiptUrl,
                    updatedAt: event.timestamp || new Date().toISOString(),
                  }
                : o
            ),
          }
        })
      }
    }, activeRestaurant?.id)

    return () => {
      unsubscribe()
    }
  }, [activeRestaurant?.id, updateActiveRestaurantRecord])

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
        const phone = cleanPhoneNumber(newOrder.customer.telefono)
        const nextCustomers = [...current.customers]
        const existingIdx = nextCustomers.findIndex(
          (c) => cleanPhoneNumber(c.telefono) === phone
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
        description: `${newOrder.customer.nombre} - ${formatCurrency(newOrder.finalTotal)}`,
      })

      // Backend API Integration with graceful offline fallback
      try {
        const phone = cleanPhoneNumber(newOrder.customer.telefono)
        const existingCustomer = activeRestaurant.customers?.find(
          (c) => cleanPhoneNumber(c.telefono) === phone
        )
        const customerId = existingCustomer && !existingCustomer.id.startsWith('cust-')
          ? existingCustomer.id
          : undefined

        const orderInput: CreateOrderInput = {
          restaurantId: activeRestaurant.id,
          customerId,
          customer: {
            name: newOrder.customer.nombre,
            phone: newOrder.customer.telefono,
            address: newOrder.customer.direccion,
            barrio: newOrder.customer.barrio,
          },
          items: newOrder.items.map((item) => {
            const matchedProduct = activeRestaurant.products?.find(
              (p) => p.name.toLowerCase() === item.name.toLowerCase() || p.id === item.id
            )
            return {
              productId: matchedProduct?.id || item.id || item.name,
              quantity: item.cantidad,
              additions: (item.adiciones || []).map((a) => (a as any).id || a.name),
            }
          }),
          deliveryFee: newOrder.deliveryFee,
          paymentMethod: newOrder.metodo,
          receiptUrl: newOrder.receiptUrl,
          comment: newOrder.comentario,
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
            if (import.meta.env?.MODE !== 'test') {
              console.warn("Could not sync order to backend API, falling back to local state:", error)
            }
          })
      } catch (err) {
        if (import.meta.env?.MODE !== 'test') {
          console.warn("Error preparing order input for backend API:", err)
        }
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

      apiClient.updateOrderStatus(orderId, newStatus, activeRestaurant.id).catch((error) => {
        if (import.meta.env?.MODE !== 'test') {
          console.warn(`Could not sync status update for order ${orderId} to backend API:`, error)
        }
      })
    },
    [activeRestaurant.id, updateActiveRestaurantRecord]
  )

  const updateOrderReceipt = useCallback(
    async (orderId: string, receiptUrl: string) => {
      updateActiveRestaurantRecord((current) => ({
        ...current,
        orders: current.orders.map((o) =>
          o.id === orderId
            ? { ...o, receiptUrl, updatedAt: new Date().toISOString() }
            : o
        ),
      }))
      toast.success("Comprobante adjuntado correctamente")

      try {
        await apiClient.updateOrderReceipt(orderId, receiptUrl, activeRestaurant.id)
      } catch (error) {
        if (import.meta.env?.MODE !== 'test') {
          console.warn(`Could not sync receipt update for order ${orderId} to backend API:`, error)
        }
      }
    },
    [activeRestaurant.id, updateActiveRestaurantRecord]
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
    updateOrderReceipt,
    deleteOrder,
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
