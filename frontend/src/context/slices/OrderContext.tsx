import React, { createContext, useContext, useMemo, useCallback, useEffect, useRef, useState } from "react"
import type { Order, OrderStatus, Customer, RestaurantRecord } from "@/types/restaurant"
import type { CreateOrderInput, UpdateOrderInput, OrderEvent, UpdateCustomerInput } from "@burger-page/contracts"
import { apiClient, isNotFoundError } from "@/core/api/apiClient"
import { calculateLineItemTotal } from "@/features/cart/cartEngine"
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
  refreshOrders: () => Promise<void>
}


const OrderContext = createContext<OrderContextType | undefined>(undefined)

function generateSecureOrderNumber(): number {
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const array = new Uint32Array(1)
    globalThis.crypto.getRandomValues(array)
    return 10000 + (array[0] % 90000)
  }
  return 10000 + (Date.now() % 90000)
}

/**
 * SUS-19: client-generated idempotency correlation id, one per sale attempt.
 * The backend replays (returns) the already-persisted order for the same
 * (restaurantId, clientOrderId), so a double-click or an offline retry after a
 * lost response can never duplicate a server order. crypto.randomUUID() needs
 * a secure context; the deterministic fallback only needs uniqueness per
 * attempt (time + random suffix), which is collision-safe for that purpose.
 */
function generateClientOrderId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `cli-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

function resolveOrderCustomer(boCustomer: any, existing?: Order, matchedCustomer?: any) {
  if (boCustomer) {
    return {
      nombre: boCustomer.nombre || boCustomer.name || existing?.customer?.nombre || 'Cliente',
      telefono: boCustomer.telefono || boCustomer.phone || existing?.customer?.telefono || '',
      direccion: boCustomer.direccion || boCustomer.address || existing?.customer?.direccion || '',
      barrio: boCustomer.barrio || existing?.customer?.barrio || '',
    }
  }
  if (matchedCustomer) {
    return {
      nombre: matchedCustomer.nombre,
      telefono: matchedCustomer.telefono,
      direccion: matchedCustomer.direccion,
      barrio: matchedCustomer.barrio,
    }
  }
  return existing?.customer ?? {
    nombre: 'Cliente',
    telefono: '',
    direccion: '',
    barrio: '',
  }
}

function computeLoyaltyTier(totalOrders: number, totalSpent?: number): Customer["loyaltyTier"] {
  if (totalSpent !== undefined) {
    if (totalSpent >= 400000 || totalOrders >= 10) return "vip"
    if (totalSpent >= 250000 || totalOrders >= 6) return "gold"
    if (totalSpent >= 100000 || totalOrders >= 3) return "silver"
    return "bronze"
  }
  if (totalOrders >= 15) return "vip"
  if (totalOrders >= 8) return "gold"
  if (totalOrders >= 3) return "silver"
  return "bronze"
}

function mapBackendOrderToDomain(bo: any, existing?: Order, matchedCustomer?: any): Order {
  const customer = resolveOrderCustomer(bo.customer, existing, matchedCustomer)

  const items = (bo.items && bo.items.length > 0 ? bo.items : existing?.items || []).map((item: any) => {
    const unitPrice = Number(item.unitPrice ?? item.price ?? 0)
    const quantity = Number(item.quantity ?? item.cantidad ?? 1)
    const additions = (item.additions || item.adiciones || []).map((a: any) => ({
      id: a.id,
      additionId: a.additionId || a.addition_id,
      name: a.additionName || a.name || 'Adición',
      price: Number(a.unitPrice ?? a.price ?? 0),
      cantidad: Number(a.quantity ?? 1),
    }))
    return {
      id: item.id,
      productId: item.productId || item.product_id,
      name: item.productName || item.name || 'Producto',
      price: unitPrice,
      cantidad: quantity,
      // Backend order items carry no per-item total: fall back to the shared
      // cart/backend formula (price + SUM(add.price * add.cantidad)) * quantity
      // so priced additions are never dropped from the read-back breakdown
      // (SUS-01, same semantics as JD-CRIT-01).
      total: Number(
        item.total ??
          calculateLineItemTotal({ price: unitPrice, cantidad: quantity, adiciones: additions })
      ),
      observacion: item.observation || item.observacion,
      src: item.src,
      adiciones: additions,
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
    pagoCon: bo.paymentAmount !== undefined ? String(bo.paymentAmount) : (bo.pagoCon ?? existing?.pagoCon),
    cambio: bo.changeAmount !== undefined ? Number(bo.changeAmount) : (bo.cambio ?? existing?.cambio),
    comentario: bo.comment || bo.comentario || existing?.comentario,
    receiptUrl: bo.receiptUrl || existing?.receiptUrl,
    status: (bo.status as OrderStatus) || existing?.status || 'pending',
    createdAt: bo.createdAt || existing?.createdAt || new Date().toISOString(),
    updatedAt: bo.updatedAt || existing?.updatedAt || new Date().toISOString(),
  }
}

// ============================================================================
// TOP-LEVEL PURE UPDATERS & MAPPERS (SonarQube typescript:S2004 compliance)
// ============================================================================

export function mapSseOrderAddition(a: any) {
  return {
    name: a.additionName || a.name || 'Adición',
    price: Number(a.unitPrice ?? a.price ?? 0),
    cantidad: Number(a.quantity ?? 1),
  }
}

export function mapSseOrderItem(item: any) {
  const unitPrice = Number(item.unitPrice ?? item.price ?? 0)
  const quantity = Number(item.quantity ?? item.cantidad ?? 1)
  const adiciones = (item.additions || item.adiciones || []).map(mapSseOrderAddition)
  return {
    id: item.id,
    name: item.productName || item.name || 'Producto',
    price: unitPrice,
    cantidad: quantity,
    // SSE order items carry no per-item total: use the shared cart/backend
    // formula so priced additions are included (SUS-01).
    total: calculateLineItemTotal({ price: unitPrice, cantidad: quantity, adiciones }),
    observacion: item.observation || item.observacion,
    adiciones,
  }
}

export function handleOrderDeletedEvent(current: RestaurantRecord, orderId: string): RestaurantRecord {
  return {
    ...current,
    orders: current.orders.filter((o) => o.id !== orderId),
  }
}

export function handleOrderReceiptUpdatedEvent(current: RestaurantRecord, event: OrderEvent): RestaurantRecord {
  const payloadReceipt = (event.payload as any)?.receiptUrl
  return {
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
  }
}

export function handleOrderCreatedEvent(current: RestaurantRecord, event: OrderEvent): RestaurantRecord {
  if (!event.payload || typeof event.payload !== "object") {
    return current
  }

  // Idempotent SSE merge: never unshift a second card when this order is
  // already present (same server id or same orderNumber).
  const alreadyPresent = current.orders.some(
    (o) =>
      o.id === event.orderId ||
      (event.orderNumber !== undefined && o.orderNumber === event.orderNumber)
  )
  if (alreadyPresent) {
    return current
  }

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
      generateSecureOrderNumber(),
    customer,
    items: (p.items || []).map(mapSseOrderItem),
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

export function handleOrderUpdatedEvent(
  current: RestaurantRecord,
  event: OrderEvent,
  matchIndex: number
): RestaurantRecord {
  const payload = (event.payload as any) || {}
  const nextOrders = current.orders.map((o, idx) => {
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
  })

  return {
    ...current,
    orders: nextOrders,
  }
}

export function updateRestaurantOrderState(current: RestaurantRecord, event: OrderEvent): RestaurantRecord {
  if (event.eventType === "ORDER_DELETED") {
    return handleOrderDeletedEvent(current, event.orderId)
  }

  if (event.eventType === "ORDER_RECEIPT_UPDATED") {
    return handleOrderReceiptUpdatedEvent(current, event)
  }

  if (
    event.eventType === "ORDER_STATUS_UPDATED" ||
    event.eventType === "ORDER_CREATED" ||
    event.eventType === "ORDER_UPDATED" ||
    event.eventType === "ORDER_CANCELLED"
  ) {
    const matchIndex = current.orders.findIndex(
      (o) =>
        o.id === event.orderId ||
        (event.orderNumber !== undefined && o.orderNumber === event.orderNumber)
    )

    if (matchIndex === -1) {
      if (event.eventType === "ORDER_CREATED") {
        return handleOrderCreatedEvent(current, event)
      }
      return current
    }

    return handleOrderUpdatedEvent(current, event, matchIndex)
  }

  return current
}

export function syncBackendOrders(
  currentOrders: Order[],
  backendOrders: any[],
  currentCustomers: Customer[]
): Order[] {
  if (!Array.isArray(backendOrders)) {
    return currentOrders
  }

  const existingMap = new Map<string, Order>()
  currentOrders.forEach((o) => existingMap.set(o.id, o))

  const serverOrders = backendOrders
    .filter((bo: any) => bo && bo.id)
    .map((bo: any) => {
      const existing = existingMap.get(bo.id)
      const matchedCustomer = currentCustomers.find((c) => c.id === bo.customerId)
      return mapBackendOrderToDomain(bo, existing, matchedCustomer)
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // Offline-created orders (pendingSync) are absent from the server response:
  // append them after the server cards so a sale entered during an API outage
  // survives the rebuild and stays retryable (REJ-02). A pending order matched
  // above by id or orderNumber was already replaced by the merge (the mapped
  // record omits pendingSync, i.e. "synced") and must not be re-appended.
  // Plain ghost orders remain dropped exactly as before.
  const serverIds = new Set(serverOrders.map((o) => o.id))
  const serverOrderNumbers = new Set(serverOrders.map((o) => o.orderNumber))
  const pendingLocalOrders = currentOrders.filter(
    (o) =>
      o.pendingSync &&
      !serverIds.has(o.id) &&
      !serverOrderNumbers.has(o.orderNumber)
  )

  return [...serverOrders, ...pendingLocalOrders]
}

export function syncBackendCustomers(
  currentCustomers: Customer[],
  backendCustomers: any[],
  nextOrders: Order[]
): Customer[] {
  if (!Array.isArray(backendCustomers)) {
    return currentCustomers
  }

  const existingMap = new Map<string, Customer>()
  currentCustomers.forEach((c) => existingMap.set(c.id, c))

  const customersMap = new Map<string, Customer>()

  backendCustomers.forEach((bc: any) => {
    if (!bc?.id) return

    const cleanPhone = cleanPhoneNumber(bc.phone || "")
    const existing =
      existingMap.get(bc.id) ||
      Array.from(existingMap.values()).find(
        (c) => cleanPhoneNumber(c.telefono) === cleanPhone
      )

    const custOrders = nextOrders.filter(
      (o) => cleanPhoneNumber(o.customer.telefono) === cleanPhone
    )
    const totalSpent = custOrders.reduce((sum, o) => sum + (o.finalTotal || o.total || 0), 0)
    const totalOrders = custOrders.length
    const lastOrderDate = custOrders[0]?.createdAt || bc.createdAt || new Date().toISOString()
    const loyaltyTier = computeLoyaltyTier(totalOrders, totalSpent)

    customersMap.set(bc.id, {
      id: bc.id,
      nombre: bc.name || existing?.nombre || "Cliente",
      telefono: bc.phone || existing?.telefono || "",
      direccion: bc.address ?? existing?.direccion ?? "",
      barrio: bc.barrio ?? existing?.barrio ?? "",
      totalOrders: totalOrders || existing?.totalOrders || 0,
      totalSpent: totalSpent || existing?.totalSpent || 0,
      lastOrderDate,
      loyaltyTier,
      notes: bc.notes ?? existing?.notes ?? "",
    })
  })

  return Array.from(customersMap.values())
}

export function syncBackendDataToRestaurant(
  current: RestaurantRecord,
  targetRestId: string,
  backendOrders: any[],
  backendCustomers: any[]
): RestaurantRecord {
  if (current.id !== targetRestId) return current

  const nextOrders = syncBackendOrders(current.orders, backendOrders, current.customers)
  const nextCustomers = syncBackendCustomers(current.customers, backendCustomers, nextOrders)

  return {
    ...current,
    orders: nextOrders,
    customers: nextCustomers,
  }
}

export function recordCustomerForNewOrder(
  customers: Customer[],
  newOrder: Order,
  timestamp: string
): Customer[] {
  const phone = cleanPhoneNumber(newOrder.customer.telefono)
  const nextCustomers = [...customers]
  const existingIdx = nextCustomers.findIndex(
    (c) => cleanPhoneNumber(c.telefono) === phone
  )

  if (existingIdx >= 0) {
    const c = nextCustomers[existingIdx]
    const newTotalOrders = c.totalOrders + 1
    const newTotalSpent = c.totalSpent + newOrder.finalTotal
    const tier = computeLoyaltyTier(newTotalOrders, newTotalSpent)

    nextCustomers[existingIdx] = {
      ...c,
      nombre: newOrder.customer.nombre,
      direccion: newOrder.customer.direccion,
      barrio: newOrder.customer.barrio,
      totalOrders: newTotalOrders,
      totalSpent: newTotalSpent,
      lastOrderDate: timestamp,
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
      lastOrderDate: timestamp,
      loyaltyTier: "bronze",
    })
  }

  return nextCustomers
}

export function addOrderToRestaurant(
  current: RestaurantRecord,
  newOrder: Order,
  timestamp: string
): RestaurantRecord {
  return {
    ...current,
    orders: [newOrder, ...current.orders],
    customers: recordCustomerForNewOrder(current.customers, newOrder, timestamp),
  }
}

/**
 * True when an API failure is a connectivity/offline problem (fetch TypeError,
 * 'Failed to fetch', …) rather than a server rejection. Server rejections keep
 * the removal semantics; network failures keep the sale pending local sync
 * (REJ-02).
 */
export function isNetworkFailure(err: unknown): boolean {
  if (!err) return false
  const anyErr = err as any
  return !!(
    anyErr.message &&
    (anyErr.message.includes('Failed to fetch') ||
      anyErr.name === 'TypeError' ||
      /NetworkError|network request failed/i.test(anyErr.message))
  )
}

/**
 * Adopts the server identity of a created order onto its optimistic temp card:
 * drops the ORDER_CREATED SSE duplicate (same server id), matches by the stable
 * temp id, and clears pendingSync when the card was held pending (REJ-02). If a
 * refresh/SSE merge already replaced the temp card, the server card is the only
 * copy and is left untouched.
 */
export function adoptCreatedOrderToActive(
  current: RestaurantRecord,
  tempOrderId: string,
  createdOrder: any
): RestaurantRecord {
  const tempStillPresent = current.orders.some((o) => o.id === tempOrderId)
  if (!tempStillPresent) return current
  const withoutSseDuplicate = current.orders.filter((o) => o.id !== createdOrder.id)
  return {
    ...current,
    orders: withoutSseDuplicate.map((o) =>
      o.id === tempOrderId
        ? {
            ...o,
            id: createdOrder.id,
            orderNumber: createdOrder.orderNumber ?? o.orderNumber,
            pendingSync: false,
          }
        : o
    ),
  }
}

function buildCreateOrderItem(item: any, products: any[], additions: any[]) {
  const matchedProduct = products?.find(
    (p) => p.name.toLowerCase() === item.name.toLowerCase() || p.id === item.id
  )
  return {
    productId: matchedProduct?.id || item.id || item.name,
    quantity: item.cantidad,
    additions: (item.adiciones || []).map((a: any) => {
      const matchedAddition = additions?.find(
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
}

export function buildCreateOrderInput(
  restaurant: RestaurantRecord,
  newOrder: Order & { clientOrderId?: string }
): CreateOrderInput {
  const phone = cleanPhoneNumber(newOrder.customer.telefono)
  const existingCustomer = restaurant.customers?.find(
    (c) => cleanPhoneNumber(c.telefono) === phone
  )
  const customerId = existingCustomer && !existingCustomer.id.startsWith('cust-')
    ? existingCustomer.id
    : undefined

  return {
    restaurantId: restaurant.id,
    customerId,
    customer: {
      name: newOrder.customer.nombre,
      phone: newOrder.customer.telefono,
      address: newOrder.customer.direccion,
      barrio: newOrder.customer.barrio,
    },
    items: newOrder.items.map((item) =>
      buildCreateOrderItem(item, restaurant.products ?? [], restaurant.additions ?? [])
    ),
    deliveryFee: newOrder.deliveryFee,
    paymentMethod: newOrder.metodo,
        paymentAmount: newOrder.pagoCon ? Number(newOrder.pagoCon) : undefined,
        changeAmount: newOrder.cambio !== undefined ? Number(newOrder.cambio) : undefined,
    receiptUrl: newOrder.receiptUrl,
    comment: newOrder.comentario,
    // SUS-19: the offline retry re-sends the same correlation id (it rebuilds
    // the input from the same optimistic order object), so the backend replays
    // instead of duplicating.
    ...(newOrder.clientOrderId ? { clientOrderId: newOrder.clientOrderId } : {}),
  }
}

function buildUpdateOrderItem(item: any, products: any[]) {
  const matchedProduct = products?.find(
    (p) => p.name.toLowerCase() === item.name.toLowerCase() || p.id === (item as any).productId || p.id === item.id
  )
  return {
    id: item.id,
    productId: matchedProduct?.id || (item as any).productId || item.id || item.name,
    productName: item.name,
    unitPrice: item.price,
    quantity: item.cantidad,
    observation: item.observacion || (item as any).instrucciones,
    additions: (item.adiciones || []).map((a: any) => {
      if (typeof a === 'string') return a
      return { additionId: (a as any).additionId || (a as any).id || (a as any).name, quantity: 1 }
    }),
  }
}

export function buildUpdateOrderInput(
  updates: Partial<Order>,
  products: any[]
): UpdateOrderInput {
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
    updateInput.items = updates.items.map((item) => buildUpdateOrderItem(item, products))
  }
  if (updates.deliveryFee !== undefined) updateInput.deliveryFee = updates.deliveryFee
  if (updates.metodo !== undefined) updateInput.paymentMethod = updates.metodo
  if (updates.pagoCon !== undefined) updateInput.paymentAmount = Number(updates.pagoCon) || undefined
  if (updates.cambio !== undefined) updateInput.changeAmount = updates.cambio
  if (updates.comentario !== undefined) updateInput.comment = updates.comentario
  if (updates.status !== undefined) updateInput.status = updates.status
  return updateInput
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

  // REJ-02: offline-created orders (pendingSync) are flushed automatically once
  // connectivity is proven — after the mount sync and after every successful
  // refresh. One create attempt per order per invocation, guarded against
  // re-entrancy; no timers, so the retry stays refresh-driven and testable.
  const retryInFlightRef = useRef(false)
  const retryPendingOrdersRef = useRef<() => Promise<void>>(async () => {})

  // SUS-19: double-click protection. Both UI entry points (ManualSaleModal,
  // CheckoutForm) trigger addOrder once per sale; a double-click can fire the
  // handler twice within the same tick, producing two optimistic cards and two
  // createOrder POSTs. The first invocation of a sale attempt is remembered;
  // a repeat trigger of the SAME payload within the double-click window is
  // dropped (same clientOrderId, same card, one API call). A legitimate new
  // sale always carries a different payload and arrives after the modal is
  // reopened (human interaction), so it can never collide. 500ms mirrors the
  // OS double-click threshold.
  const DOUBLE_CLICK_WINDOW_MS = 500
  const lastSaleAttemptRef = useRef<{ key: string; at: number; order: Order } | null>(null)

  const attemptPendingOrderSync = useCallback(
    async (order: Order) => {
      const targetRestId = activeRestaurant?.id
      if (!targetRestId) return
      try {
        const orderInput = buildCreateOrderInput(activeRestaurant, order)
        const createdOrder = await apiClient.createOrder(orderInput)
        if (!createdOrder?.id) {
          // Accepted but no body returned: the order is persisted server-side;
          // keep the optimistic card and stop treating it as pending.
          updateActiveRestaurantRecord((current) => ({
            ...current,
            orders: current.orders.map((o) =>
              o.id === order.id ? { ...o, pendingSync: false } : o
            ),
          }))
          return
        }
        // Adopt the server identity exactly like addOrder's success path
        // (SSE-duplicate collapse included) and clear the pending flag.
        updateActiveRestaurantRecord((current) =>
          adoptCreatedOrderToActive(current, order.id, createdOrder)
        )
      } catch (error) {
        if (isNetworkFailure(error)) {
          // Still offline: keep the pending flag; the next refresh retries.
          return
        }
        // Server rejection: the order can never sync — surface it and remove
        // the card, mirroring addOrder's rejection semantics (REJ-02).
        if (import.meta.env?.MODE !== 'test') {
          console.warn("Server rejected a pending order during retry; removing it:", error)
        }
        updateActiveRestaurantRecord((current) => ({
          ...current,
          orders: current.orders.filter((o) => o.id !== order.id),
        }))
        const err = error as any
        toast.error(`No se pudo registrar la orden #${order.orderNumber}`, {
          description:
            err && typeof err.message === 'string'
              ? err.message
              : 'El servidor no está disponible en este momento',
        })
      }
    },
    [activeRestaurant, updateActiveRestaurantRecord]
  )

  const retryPendingOrders = useCallback(async () => {
    const targetRestId = activeRestaurant?.id
    if (!targetRestId || !apiClient.hasToken()) return
    if (retryInFlightRef.current) return
    const pendingOrders = activeRestaurant.orders.filter((o) => o.pendingSync)
    if (pendingOrders.length === 0) return
    retryInFlightRef.current = true
    try {
      await Promise.all(pendingOrders.map((order) => attemptPendingOrderSync(order)))
    } finally {
      retryInFlightRef.current = false
    }
  }, [activeRestaurant, attemptPendingOrderSync])

  // Keep the latest retry callback reachable from the mount/refresh effects
  // without re-running them on every restaurant record identity change.
  useEffect(() => {
    retryPendingOrdersRef.current = retryPendingOrders
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
        updateActiveRestaurantRecord((current) =>
          syncBackendDataToRestaurant(current, targetRestId, backendOrders, backendCustomers)
        )
        // The fetch just proved connectivity: flush orders held pendingSync
        // during the outage (REJ-02).
        void retryPendingOrdersRef.current()
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
      updateActiveRestaurantRecord((current) => updateRestaurantOrderState(current, event))
    }, targetRestId)

    return () => {
      unsubscribe()
    }
  }, [activeRestaurant?.id, session, updateActiveRestaurantRecord])

  const addOrder = useCallback(
    (orderData: Omit<Order, "id" | "orderNumber" | "createdAt" | "updatedAt">) => {
      const attemptKey = JSON.stringify(orderData)
      const lastAttempt = lastSaleAttemptRef.current
      if (
        lastAttempt &&
        lastAttempt.key === attemptKey &&
        Date.now() - lastAttempt.at <= DOUBLE_CLICK_WINDOW_MS
      ) {
        // Same sale placed twice within the double-click window: drop the
        // repeat trigger — the first invocation already created the optimistic
        // card and the createOrder call carrying this attempt's clientOrderId.
        return lastAttempt.order
      }

      const now = new Date().toISOString()
      const clientOrderId = generateClientOrderId()
      const newOrder: Order = {
        ...orderData,
        id: nextTempId("ord"),
        orderNumber: generateSecureOrderNumber(),
        createdAt: now,
        updatedAt: now,
      }
      // SUS-19: the correlation id rides on the optimistic Order so the offline
      // retry (attemptPendingOrderSync) rebuilds the input from this same
      // object and re-sends the SAME id — the server replays the first order.
      ;(newOrder as Order & { clientOrderId?: string }).clientOrderId = clientOrderId
      lastSaleAttemptRef.current = { key: attemptKey, at: Date.now(), order: newOrder }

      updateActiveRestaurantRecord((current) => addOrderToRestaurant(current, newOrder, now))

      if (soundEnabled) {
        playNotificationChime()
      }

      // Backend API integration. The card is optimistic; the outcome toast is
      // only shown once the server answers: success adopts the server identity
      // (temp id -> server id, SSE duplicate collapse), and a rejection shows
      // an error and removes the temporary card so a phantom order is never
      // silently dropped by the next refresh/SSE sync without user visibility.
      try {
        const orderInput = buildCreateOrderInput(activeRestaurant, newOrder)

        apiClient
          .createOrder(orderInput)
          .then((createdOrder) => {
            const adoptedOrderNumber = createdOrder?.orderNumber ?? newOrder.orderNumber
            if (!createdOrder?.id) {
              // Server accepted but returned no body: keep the optimistic card
              // (it still represents a persisted order) and confirm success.
              toast.success(`Orden #${adoptedOrderNumber} registrada`, {
                description: `${newOrder.customer.nombre} - ${formatCurrency(newOrder.finalTotal)}`,
              })
              return
            }
            updateActiveRestaurantRecord((current) =>
              adoptCreatedOrderToActive(current, newOrder.id, createdOrder)
            )
            toast.success(`Orden #${adoptedOrderNumber} registrada`, {
              description: `${newOrder.customer.nombre} - ${formatCurrency(newOrder.finalTotal)}`,
            })
          })
          .catch((error) => {
            if (isNetworkFailure(error)) {
              // Pure connectivity failure (offline, 'Failed to fetch'): the
              // sale must not be destroyed with no record and no retry — keep
              // the optimistic card marked pendingSync and flush it once a
              // fetch/refresh proves connectivity again (REJ-02).
              if (import.meta.env?.MODE !== 'test') {
                console.warn(
                  "Could not sync order to backend API; keeping the order pending local sync:",
                  error
                )
              }
              updateActiveRestaurantRecord((current) => ({
                ...current,
                orders: current.orders.map((o) =>
                  o.id === newOrder.id ? { ...o, pendingSync: true } : o
                ),
              }))
              toast.warning('Sin conexión: la venta quedó guardada localmente y se sincronizará automáticamente')
              return
            }
            if (import.meta.env?.MODE !== 'test') {
              console.warn("Could not sync order to backend API, removing local optimistic order:", error)
            }
            // The server rejected the order (unavailable product, min order,
            // cash below final total, tenant mismatch...): surface it and drop
            // the temporary card instead of pretending the sale succeeded.
            updateActiveRestaurantRecord((current) => ({
              ...current,
              orders: current.orders.filter((o) => o.id !== newOrder.id),
            }))
            const err = error as any
            const description =
              err && typeof err.message === 'string'
                ? err.message
                : 'El servidor no está disponible en este momento'
            toast.error(`No se pudo registrar la orden #${newOrder.orderNumber}`, {
              description,
            })
          })
      } catch (err) {
        if (import.meta.env?.MODE !== 'test') {
          console.warn("Error preparing order input for backend API:", err)
        }
        // Input preparation never reached the server (local condition): treat
        // it like an offline failure and keep the sale pending sync instead of
        // deleting it (REJ-02).
        updateActiveRestaurantRecord((current) => ({
          ...current,
          orders: current.orders.map((o) =>
            o.id === newOrder.id ? { ...o, pendingSync: true } : o
          ),
        }))
        toast.warning('Sin conexión: la venta quedó guardada localmente y se sincronizará automáticamente')
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
          const updateInput = buildUpdateOrderInput(updates, activeRestaurant.products ?? [])
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
      // Snapshot the committed state so a rejected backend transition can
      // roll the kanban back instead of silently diverging from the server.
      const previousOrders = activeRestaurant.orders

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
        // Revert the optimistic status and surface a user-visible error so
        // the kanban never silently diverges from server state.
        updateActiveRestaurantRecord((current) => ({
          ...current,
          orders: previousOrders,
        }))
        toast.error(`No se pudo actualizar la orden a: ${newStatus.toUpperCase()}`)
      })
    },
    [activeRestaurant, updateActiveRestaurantRecord]
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
          if (isNotFoundError(err)) {
            // Already deleted or never existed in server DB: keep client deletion without rollback
            return
          }

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
                      direccion: updatedCustomer.address ?? c.direccion,
                      barrio: updatedCustomer.barrio ?? c.barrio,
                      notes: updatedCustomer.notes ?? c.notes,
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


  const refreshOrders = useCallback(async () => {
    const targetRestId = activeRestaurant?.id
    if (!targetRestId || !apiClient.hasToken()) return
    setIsLoadingOrders(true)
    try {
      const [backendOrders, backendCustomers] = await Promise.all([
        apiClient.fetchOrders(targetRestId),
        apiClient.fetchCustomers(targetRestId).catch((err) => {
          if (import.meta.env?.MODE !== 'test') {
            console.warn("Could not fetch customers from backend API:", err)
          }
          return []
        }),
      ])
      updateActiveRestaurantRecord((current) =>
        syncBackendDataToRestaurant(current, targetRestId, backendOrders, backendCustomers)
      )
      // A successful refresh proves connectivity: flush offline-created orders
      // held as pendingSync (REJ-02).
      await retryPendingOrders()
    } catch (err) {
      if (import.meta.env?.MODE !== 'test') {
        console.warn("Could not refresh orders from backend API:", err)
      }
    } finally {
      setIsLoadingOrders(false)
    }
  }, [activeRestaurant?.id, updateActiveRestaurantRecord, retryPendingOrders])

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
    refreshOrders,
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
