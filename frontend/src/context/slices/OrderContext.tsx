import React, { createContext, useContext, useMemo, useCallback, useEffect, useState } from "react"
import type { Order, OrderStatus, Customer } from "@/types/restaurant"
import type { CreateOrderInput, UpdateOrderInput, OrderEvent, UpdateCustomerInput } from "@burger-page/contracts"
import { apiClient } from "@/core/api/apiClient"
import { useTenant } from "./TenantContext"
import { useAuth } from "./AuthContext"
import { useUi } from "./UiContext"
import { playNotificationChime } from "@/core/audio/soundEffects"
import { toast } from "sonner"
import { formatCurrency, cleanPhoneNumber } from "@/lib/utils"
import { nextTempId } from "@/lib/ids"

export interface OrderContextType {
  orders: Order[]
  addOrder: (orderData: Omit<Order, "id" | "orderNumber" | "createdAt" | "updatedAt">) => Order
  updateOrder: (orderId: string, updates: Partial<Order>) => void
  updateOrderStatus: (orderId: string, newStatus: OrderStatus) => void
  updateOrderReceipt: (orderId: string, receiptUrl: string) => Promise<void>
  deleteOrder: (orderId: string) => Promise<void> | void
  customers: Customer[]
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void> | void
  pendingOrdersCount: number
  isLoadingOrders: boolean
}


const OrderContext = createContext<OrderContextType | undefined>(undefined)

function mapBackendOrderToDomain(bo: any, existing?: Order, matchedCustomer?: any): Order {
  const customer = bo.customer
    ? {
        nombre: bo.customer.nombre || bo.customer.name || existing?.customer?.nombre || 'Cliente',
        telefono: bo.customer.telefono || bo.customer.phone || existing?.customer?.telefono || '',
        direccion: bo.customer.direccion || bo.customer.address || existing?.customer?.direccion || '',
        barrio: bo.customer.barrio || existing?.customer?.barrio || '',
      }
    : matchedCustomer
      ? {
          nombre: matchedCustomer.nombre,
          telefono: matchedCustomer.telefono,
          direccion: matchedCustomer.direccion,
          barrio: matchedCustomer.barrio,
        }
      : existing?.customer || {
          nombre: 'Cliente',
          telefono: '',
          direccion: '',
          barrio: '',
        }

  const items = (bo.items && bo.items.length > 0 ? bo.items : existing?.items || []).map((item: any) => {
    const unitPrice = Number(item.unitPrice ?? item.price ?? 0)
    const quantity = Number(item.quantity ?? item.cantidad ?? 1)
    return {
      id: item.id,
      name: item.productName || item.name || 'Producto',
      price: unitPrice,
      cantidad: quantity,
      total: Number(item.total ?? (unitPrice * quantity)),
      observacion: item.observation || item.observacion,
      src: item.src,
      adiciones: (item.additions || item.adiciones || []).map((a: any) => ({
        name: a.additionName || a.name || 'Adición',
        price: Number(a.unitPrice ?? a.price ?? 0),
        cantidad: Number(a.quantity ?? 1),
      })),
    }
  })

  return {
    id: bo.id,
    orderNumber: bo.orderNumber || existing?.orderNumber || 0,
    customer,
    items,
    total: Number(bo.subtotal ?? bo.total ?? existing?.total ?? 0),
    deliveryFee: Number(bo.deliveryFee ?? existing?.deliveryFee ?? 0),
    finalTotal: Number(bo.finalTotal ?? bo.total ?? existing?.finalTotal ?? 0),
    metodo: (bo.paymentMethod || bo.metodo || existing?.metodo || 'Efectivo') as any,
    pagoCon: bo.paymentAmount !== undefined ? String(bo.paymentAmount) : (bo.pagoCon || existing?.pagoCon),
    cambio: bo.changeAmount !== undefined ? Number(bo.changeAmount) : (bo.cambio || existing?.cambio),
    comentario: bo.comment || bo.comentario || existing?.comentario,
    receiptUrl: bo.receiptUrl || existing?.receiptUrl,
    status: (bo.status as OrderStatus) || existing?.status || 'pending',
    createdAt: bo.createdAt || existing?.createdAt || new Date().toISOString(),
    updatedAt: bo.updatedAt || existing?.updatedAt || new Date().toISOString(),
  }
}

export const OrderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeRestaurant, updateActiveRestaurantRecord } = useTenant()
  const { session } = useAuth()
  const { soundEnabled } = useUi()

  const [isLoadingOrders, setIsLoadingOrders] = useState<boolean>(() => {
    return Boolean(
      apiClient.hasToken() &&
        activeRestaurant?.id &&
        (!activeRestaurant.orders || activeRestaurant.orders.length === 0)
    )
  })

  // Synchronize orders & customers with backend if token & restaurant context exist
  useEffect(() => {
    if (!apiClient.hasToken() || !activeRestaurant?.id) return

    let isCancelled = false
    const targetRestId = activeRestaurant.id

    Promise.all([
      apiClient.fetchOrders(targetRestId),
      apiClient.fetchCustomers(targetRestId).catch((err) => {
        if (import.meta.env?.MODE !== 'test') {
          console.warn("Could not fetch customers from backend API:", err)
        }
        return []
      }),
    ])
      .then(([backendOrders, backendCustomers]) => {
        if (isCancelled) return
        updateActiveRestaurantRecord((current) => {
          if (current.id !== targetRestId) return current

          // 1. Sync orders
          const ordersMap = new Map<string, Order>()
          current.orders.forEach((o) => ordersMap.set(o.id, o))
          if (Array.isArray(backendOrders)) {
            backendOrders.forEach((bo: any) => {
              if (bo && bo.id) {
                const existing = ordersMap.get(bo.id)
                const matchedCustomer = current.customers.find((c) => c.id === bo.customerId)
                ordersMap.set(bo.id, mapBackendOrderToDomain(bo, existing, matchedCustomer))
              }
            })
          }
          const nextOrders = Array.from(ordersMap.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )

          // 2. Sync customers
          const customersMap = new Map<string, Customer>()
          current.customers.forEach((c) => customersMap.set(c.id, c))

          if (Array.isArray(backendCustomers) && backendCustomers.length > 0) {
            backendCustomers.forEach((bc: any) => {
              if (bc && bc.id) {
                const cleanPhone = cleanPhoneNumber(bc.phone || '')
                const existing =
                  customersMap.get(bc.id) ||
                  Array.from(customersMap.values()).find(
                    (c) => cleanPhoneNumber(c.telefono) === cleanPhone
                  )

                if (existing) {
                  customersMap.delete(existing.id)
                  customersMap.set(bc.id, {
                    ...existing,
                    id: bc.id,
                    nombre: bc.name || existing.nombre,
                    telefono: bc.phone || existing.telefono,
                    direccion: bc.address !== undefined ? bc.address : existing.direccion,
                    barrio: bc.barrio !== undefined ? bc.barrio : existing.barrio,
                    notes: bc.notes !== undefined ? bc.notes : existing.notes,
                  })
                } else {
                  const custOrders = nextOrders.filter(
                    (o) => cleanPhoneNumber(o.customer.telefono) === cleanPhone
                  )
                  const totalSpent = custOrders.reduce((sum, o) => sum + (o.finalTotal || o.total || 0), 0)
                  const totalOrders = custOrders.length
                  const lastOrderDate = custOrders[0]?.createdAt || bc.createdAt || new Date().toISOString()
                  const loyaltyTier =
                    totalOrders >= 15 ? "vip" : totalOrders >= 8 ? "gold" : totalOrders >= 3 ? "silver" : "bronze"

                  customersMap.set(bc.id, {
                    id: bc.id,
                    nombre: bc.name || "Cliente",
                    telefono: bc.phone || "",
                    direccion: bc.address || "",
                    barrio: bc.barrio || "",
                    totalOrders,
                    totalSpent,
                    lastOrderDate,
                    loyaltyTier,
                    notes: bc.notes || "",
                  })
                }
              }
            })
          }

          return {
            ...current,
            orders: nextOrders,
            customers: Array.from(customersMap.values()),
          }
        })
      })
      .catch((err) => {
        if (import.meta.env?.MODE !== 'test') {
          console.warn("Could not fetch orders/customers from backend API:", err)
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingOrders(false)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [activeRestaurant?.id, session, updateActiveRestaurantRecord])


  // Real-time SSE order stream subscription
  useEffect(() => {
    const targetRestId = activeRestaurant?.id
    if (!targetRestId || !apiClient.hasToken()) return
    const unsubscribe = apiClient.subscribeToOrderStream((event: OrderEvent) => {
      if (!event || !event.orderId) return

      if (event.eventType === "ORDER_DELETED") {
        updateActiveRestaurantRecord((current) => ({
          ...current,
          orders: current.orders.filter((o) => o.id !== event.orderId),
        }))
        return
      }

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

          const payload = (event.payload as any) || {}
          return {
            ...current,
            orders: current.orders.map((o, idx) => {
              if (idx !== matchIndex) return o
              if (event.eventType === "ORDER_UPDATED" && payload) {
                return mapBackendOrderToDomain(
                  {
                    ...payload,
                    id: event.orderId || o.id,
                    status: event.status || payload.status || o.status,
                    updatedAt: event.timestamp || new Date().toISOString(),
                  },
                  o
                )
              }
              return {
                ...o,
                id: event.orderId || o.id,
                status: (event.status as OrderStatus) || (payload.status as OrderStatus) || o.status,
                receiptUrl: payload.receiptUrl || o.receiptUrl,
                updatedAt: event.timestamp || new Date().toISOString(),
              }
            }),
          }
        })
      }
    }, targetRestId)

    return () => {
      unsubscribe()
    }
  }, [activeRestaurant?.id, session, updateActiveRestaurantRecord])

  const addOrder = useCallback(
    (orderData: Omit<Order, "id" | "orderNumber" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString()
      const newOrder: Order = {
        ...orderData,
        id: nextTempId("ord"),
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
              additions: (item.adiciones || []).map((a) => {
                const matchedAddition = activeRestaurant.additions?.find(
                  (add) =>
                    add.name.toLowerCase() === a.name?.toLowerCase() ||
                    add.id === (a as any).id ||
                    add.id === (a as any).additionId
                )
                return {
                  additionId: matchedAddition?.id || (a as any).additionId || (a as any).id || a.name,
                  quantity: typeof a.cantidad === 'number' && a.cantidad > 0 ? a.cantidad : 1,
                }
              }),
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
                  o === newOrder
                    ? { ...o, id: createdOrder.id, orderNumber: createdOrder.orderNumber ?? o.orderNumber }
                    : o
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

  const updateOrder = useCallback(
    async (orderId: string, updates: Partial<Order>) => {
      const now = new Date().toISOString()
      const targetRestId = activeRestaurant?.id
      let previousOrders: Order[] = []

      // Optimistic local update
      updateActiveRestaurantRecord((current) => {
        previousOrders = current.orders
        return {
          ...current,
          orders: current.orders.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  ...updates,
                  updatedAt: now,
                }
              : o
          ),
        }
      })
      toast.success("Venta actualizada correctamente")

      // Backend sync
      if (apiClient.hasToken() && targetRestId) {
        try {
          const updateInput: UpdateOrderInput = {}
          if (updates.customer) {
            updateInput.customer = {
              name: updates.customer.nombre,
              phone: updates.customer.telefono,
              address: updates.customer.direccion,
              barrio: updates.customer.barrio,
            }
          }
          if (updates.items) {
            updateInput.items = updates.items.map((item) => {
              const matchedProduct = activeRestaurant.products?.find(
                (p) => p.name.toLowerCase() === item.name.toLowerCase() || p.id === item.id
              )
              return {
                productId: matchedProduct?.id || item.id || item.name,
                quantity: item.cantidad,
                observation: item.observacion || (item as any).instrucciones,
                additions: (item.adiciones || []).map((a) => {
                  if (typeof a === 'string') return a
                  return { additionId: (a as any).id || (a as any).name, quantity: 1 }
                }),
              }
            })
          }
          if (updates.deliveryFee !== undefined) updateInput.deliveryFee = updates.deliveryFee
          if (updates.metodo !== undefined) updateInput.paymentMethod = updates.metodo
          if (updates.pagoCon !== undefined) updateInput.paymentAmount = Number(updates.pagoCon) || undefined
          if (updates.cambio !== undefined) updateInput.changeAmount = updates.cambio
          if (updates.comentario !== undefined) updateInput.comment = updates.comentario
          if (updates.status !== undefined) updateInput.status = updates.status

          const updatedOrder = await apiClient.updateOrder(orderId, updateInput, targetRestId)
          if (updatedOrder) {
            updateActiveRestaurantRecord((current) => ({
              ...current,
              orders: current.orders.map((o) => (o.id === orderId ? mapBackendOrderToDomain(updatedOrder, o) : o)),
            }))
          }
        } catch (err) {
          if (import.meta.env?.MODE !== 'test') {
            console.error("Error al actualizar orden en el servidor:", err)
          }
          toast.error("No se pudo sincronizar la actualización con el servidor")
          // Rollback to pre-optimistic snapshot
          updateActiveRestaurantRecord((current) => ({
            ...current,
            orders: previousOrders,
          }))
        }
      }
    },
    [activeRestaurant, updateActiveRestaurantRecord]
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
    async (orderId: string) => {
      const targetRestId = activeRestaurant?.id
      let previousOrders: Order[] = []

      // Optimistic update
      updateActiveRestaurantRecord((current) => {
        previousOrders = current.orders
        return {
          ...current,
          orders: current.orders.filter((o) => o.id !== orderId),
        }
      })
      toast.success("Orden eliminada")

      if (apiClient.hasToken() && targetRestId) {
        try {
          await apiClient.deleteOrder(orderId, targetRestId)
        } catch (err: any) {
          console.error("Error al eliminar orden del servidor:", err)
          toast.error("No se pudo eliminar la orden del servidor")
          // Rollback on server error
          updateActiveRestaurantRecord((current) => ({
            ...current,
            orders: previousOrders,
          }))
        }
      }
    },
    [activeRestaurant?.id, updateActiveRestaurantRecord]
  )

  const updateCustomer = useCallback(
    async (id: string, updates: Partial<Customer>) => {
      const targetRestId = activeRestaurant?.id
      let previousCustomers: Customer[] = []

      // 1. Optimistic local update
      updateActiveRestaurantRecord((current) => {
        previousCustomers = current.customers
        return {
          ...current,
          customers: current.customers.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        }
      })
      toast.success("Ficha del cliente actualizada")

      // 2. Persist to backend if token and restaurant context exist
      if (apiClient.hasToken() && targetRestId) {
        try {
          const updateInput: UpdateCustomerInput = {}
          if (updates.nombre !== undefined) updateInput.name = updates.nombre
          if (updates.telefono !== undefined) updateInput.phone = updates.telefono
          if (updates.direccion !== undefined) updateInput.address = updates.direccion
          if (updates.barrio !== undefined) updateInput.barrio = updates.barrio
          if (updates.notes !== undefined) updateInput.notes = updates.notes

          const updatedCustomer = await apiClient.updateCustomer(id, updateInput, targetRestId)
          if (updatedCustomer) {
            updateActiveRestaurantRecord((current) => ({
              ...current,
              customers: current.customers.map((c) =>
                c.id === id
                  ? {
                      ...c,
                      id: updatedCustomer.id || c.id,
                      nombre: updatedCustomer.name ?? c.nombre,
                      telefono: updatedCustomer.phone ?? c.telefono,
                      direccion: updatedCustomer.address !== undefined ? updatedCustomer.address : c.direccion,
                      barrio: updatedCustomer.barrio !== undefined ? updatedCustomer.barrio : c.barrio,
                      notes: updatedCustomer.notes !== undefined ? updatedCustomer.notes : c.notes,
                    }
                  : c
              ),
            }))
          }
        } catch (err) {
          if (import.meta.env?.MODE !== 'test') {
            console.error("Error al actualizar cliente en el servidor:", err)
          }
          toast.error("No se pudo sincronizar el cliente con el servidor")
          // Rollback to pre-optimistic snapshot
          updateActiveRestaurantRecord((current) => ({
            ...current,
            customers: previousCustomers,
          }))
        }
      }
    },
    [activeRestaurant?.id, updateActiveRestaurantRecord]
  )


  const pendingOrdersCount = useMemo(() => {
    return activeRestaurant.orders.filter((o) => o.status === "pending").length
  }, [activeRestaurant.orders])

  const value: OrderContextType = {
    orders: activeRestaurant.orders,
    addOrder,
    updateOrder,
    updateOrderStatus,
    updateOrderReceipt,
    deleteOrder,
    customers: activeRestaurant.customers,
    updateCustomer,
    pendingOrdersCount,
    isLoadingOrders,
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
