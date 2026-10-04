import React, { createContext, useContext, useMemo, useCallback, useEffect, useRef, useState } from "react"
import { hashKey, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { Order, OrderStatus, Customer, RestaurantRecord } from "@/types/restaurant"
import type { CreateOrderInput, UpdateOrderInput, OrderEvent, UpdateCustomerInput } from "@burger-page/contracts"
import { ORDER_CLOSED_ERROR_FRAGMENT, ORDER_PAUSED_ERROR_FRAGMENT } from "@burger-page/contracts"
import { apiClient, isNotFoundError } from "@/core/api/apiClient"
import { calculateLineItemTotal } from "@/features/cart/cartEngine"
import { useTenant } from "./TenantContext"
import { useAuth } from "./AuthContext"
import { useUi } from "./UiContext"
import { playNotificationChime } from "@/core/audio/soundEffects"
import { toast } from "sonner"
import { formatCurrency, cleanPhoneNumber } from "@/lib/utils"
import { nextTempId } from "@/lib/ids"
import { keys, keyPrefixes } from "@/core/query/keys"
import { ordersQueryOptions } from "@/core/query/options"
import {
  EMPTY_BOARD,
  ORDER_WRITES_KEY,
  mapBackendOrderToDomain,
  computeLoyaltyTier,
  takeDeferredRead,
  type OrderBoard,
} from "./orderBoard"

export { syncBackendOrders, syncBackendCustomers } from "./orderBoard"

export interface ServerOrderResult {
  adoptedOrderNumber: number
  createdOrder?: any
  offline?: boolean
}

export type PlacedOrder = Order & {
  serverPromise?: Promise<ServerOrderResult>
}

export interface OrderContextType {
  orders: Order[]
  addOrder: (orderData: Omit<Order, "id" | "orderNumber" | "createdAt" | "updatedAt">) => PlacedOrder
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

export function handleOrderDeletedEvent<T extends OrderBoard>(current: T, orderId: string): T {
  return {
    ...current,
    orders: current.orders.filter((o) => o.id !== orderId),
  }
}

export function handleOrderReceiptUpdatedEvent<T extends OrderBoard>(current: T, event: OrderEvent): T {
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

export function handleOrderCreatedEvent<T extends OrderBoard>(current: T, event: OrderEvent): T {
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
    pagoCon: p.paymentAmount != null ? String(p.paymentAmount) : p.pagoCon,
    cambio: p.changeAmount != null ? Number(p.changeAmount) : p.cambio,
    comentario: p.comment || p.comentario,
    receiptUrl: p.receiptUrl,
    ...(p.tableId ? { tableId: p.tableId as string } : {}),
    ...(p.tableLabel ? { tableLabel: p.tableLabel as string } : {}),
    status: (event.status as OrderStatus) || p.status || "pending",
    createdAt: event.timestamp || new Date().toISOString(),
    updatedAt: event.timestamp || new Date().toISOString(),
  }

  return {
    ...current,
    orders: [newOrder, ...current.orders],
  }
}

export function handleOrderUpdatedEvent<T extends OrderBoard>(
  current: T,
  event: OrderEvent,
  matchIndex: number
): T {
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

export function updateRestaurantOrderState<T extends OrderBoard>(current: T, event: OrderEvent): T {
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

export function addOrderToRestaurant<T extends OrderBoard>(
  current: T,
  newOrder: Order,
  timestamp: string
): T {
  return {
    ...current,
    orders: [newOrder, ...current.orders],
    customers: recordCustomerForNewOrder(current.customers, newOrder, timestamp),
  }
}

// Automatic retry of pending (unsynced) orders: bounded exponential backoff so
// a persistently failing server is never hammered and never retried forever.
// Delays: 5s, 10s, 20s, 40s, 60s, 60s, ... for at most MAX attempts.
export const PENDING_RETRY_BASE_MS = 5_000
export const PENDING_RETRY_MAX_MS = 60_000
export const MAX_PENDING_RETRY_ATTEMPTS = 8

/**
 * True when a submission failure leaves the outcome UNKNOWN or temporarily
 * unavailable, as opposed to a definitive server rejection: connectivity
 * problems (fetch TypeError, 'Failed to fetch'), client-side abort/timeout,
 * and HTTP 5xx / 408 (gateway or server failures where the server may already
 * have committed the order). These keep the sale pending and are retried with
 * the SAME clientOrderId (the server replays idempotently); 4xx responses are
 * rejections that keep the removal semantics (REJ-02).
 */
export function isNetworkFailure(err: unknown): boolean {
  if (!err) return false
  const anyErr = err as any
  if (typeof anyErr.status === 'number' && (anyErr.status >= 500 || anyErr.status === 408)) {
    return true
  }
  if (anyErr.name === 'AbortError' || anyErr.name === 'TimeoutError') return true
  return !!(
    anyErr.message &&
    (anyErr.message.includes('Failed to fetch') ||
      anyErr.name === 'TypeError' ||
      /NetworkError|network request failed/i.test(anyErr.message))
  )
}

/**
 * Maps raw backend/domain error messages into friendly, user-facing Spanish copy.
 */
export function formatUserFacingOrderError(rawMessage?: string): string {
  if (!rawMessage || typeof rawMessage !== 'string' || !rawMessage.trim()) {
    return 'El servidor no está disponible en este momento'
  }
  const msg = rawMessage.toLowerCase()

  if (
    msg.includes('below the minimum required') ||
    msg.includes('inferior al mínimo') ||
    (msg.includes('subtotal') && (msg.includes('minimum') || msg.includes('mínimo') || msg.includes('requerido')))
  ) {
    return 'El monto del pedido no alcanza el pedido mínimo requerido por el restaurante.'
  }

  if (
    msg.includes('product is currently not available') ||
    msg.includes('not found or not available') ||
    msg.includes('producto no encontrado') ||
    (msg.includes('producto') && (msg.includes('no está disponible') || msg.includes('no disponible')))
  ) {
    return 'Uno de los productos seleccionados ya no está disponible.'
  }

  if (
    msg.includes('addition is currently not available') ||
    msg.includes('addition not found') ||
    msg.includes('adición no encontrada') ||
    (msg.includes('adición') && (msg.includes('no está disponible') || msg.includes('no disponible') || msg.includes('no aplica'))) ||
    msg.includes('not applicable to product')
  ) {
    return 'Una de las adiciones seleccionadas ya no está disponible.'
  }

  if (
    (msg.includes('payment amount') && msg.includes('less than final total')) ||
    (msg.includes('monto') && (msg.includes('menor al total') || msg.includes('menor que el total')))
  ) {
    return 'El monto en efectivo ingresado es menor al total a pagar.'
  }

  if (msg.includes(ORDER_PAUSED_ERROR_FRAGMENT)) {
    return "El restaurante tiene los pedidos en pausa en este momento. Intenta de nuevo más tarde."
  }

  if (msg.includes(ORDER_CLOSED_ERROR_FRAGMENT)) {
    return "El restaurante se encuentra fuera del horario de atención. Intenta de nuevo cuando esté abierto."
  }

  if (
    (msg.includes('restaurant') && msg.includes('inactive')) ||
    (msg.includes('restaurante') && (msg.includes('no está activo') || msg.includes('inactivo')))
  ) {
    return 'El restaurante no está recibiendo pedidos en este momento.'
  }

  return rawMessage
}

/**
 * Adopts the server identity of a created order onto its optimistic temp card:
 * drops the ORDER_CREATED SSE duplicate (same server id), matches by the stable
 * temp id, and clears pendingSync when the card was held pending (REJ-02). If a
 * refresh/SSE merge already replaced the temp card, the server card is the only
 * copy and is left untouched.
 */
export function adoptCreatedOrderToActive<T extends OrderBoard>(
  current: T,
  tempOrderId: string,
  createdOrder: any
): T {
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
    observation: item.observacion || undefined,
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
    ...(newOrder.tableId ? { tableId: newOrder.tableId } : {}),
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
  // A sale edit always states its table: the key present with no value
  // detaches the order from its table.
  if ('tableId' in updates) updateInput.tableId = updates.tableId ?? null
  return updateInput
}

// Each write carries its already-dispatched request: the HTTP call fires at the
// user action (as before, so addOrder stays synchronous) and the mutation
// tracks it. The callbacks settle the promise the optimistic flow awaits.
interface OrderWrite {
  request: Promise<unknown>
  /** Order the write targets; SSE events for it are deferred while it is pending. */
  orderId?: string
  /** False for order creation: the response already carries the server identity (no SSE can target its temp id either). */
  revalidate?: boolean
  resolve: (result: any) => void
  reject: (error: unknown) => void
}

/**
 * One optimistic edit of the cached board: an order edit, status change,
 * receipt, deletion or customer edit. The edit mutation applies it in
 * onMutate, undoes it in onError and revalidates in onSettled.
 */
interface OrderEdit {
  /** Order the edit targets; SSE events for it are ignored while it is pending. */
  orderId?: string
  apply: (board: OrderBoard) => OrderBoard
  /** Undoes the edit on the current board; `snapshot` is the board before it. */
  rollback: (board: OrderBoard, snapshot: OrderBoard) => OrderBoard
  /** The server call; undefined for a local-only edit (no session or tenant). */
  request?: () => Promise<any>
  /** The dispatched call (set by dispatchEdit, at the user action). */
  pending?: Promise<any>
  /** Applies the server's answer (when it returns a body). */
  reconcile?: (board: OrderBoard, result: any) => OrderBoard
  toast: {
    /** toast.success, right after apply unless successTiming is "confirmed". */
    success?: string
    successTiming?: "optimistic" | "confirmed"
    /** toast.info right after apply (instead of success). */
    info?: string
    error: string
  }
  /** A failure this returns true for is ignored: no rollback, no error toast. */
  skipRollbackIfError?: (err: unknown) => boolean
  warnMessage: string
}

export const OrderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeRestaurant, updateActiveRestaurantRecord } = useTenant()
  const { session } = useAuth()
  const { soundEnabled } = useUi()

  // A1/A2: all backend targets below key on the session-aware effective tenant
  // instead of the persisted activeRestaurant record, so a restaurant admin's
  // first render (and every refreshed effect) fetches/streams THEIR tenant and
  // never the stale persisted one.
  const effectiveId =
    session.role === "restaurant" && session.restaurantId
      ? session.restaurantId
      : activeRestaurant?.id

  const queryClient = useQueryClient()

  // Same gating as before the migration: a session token and a tenant. An
  // anonymous storefront visitor (public checkout) never requests the private
  // orders/customers endpoints. The role is part of the key so a cache entry is
  // never served across roles; logout clears the whole client.
  const enabled = Boolean(effectiveId && apiClient.hasToken())
  const boardKey = useMemo(() => keys.orders(effectiveId, session.role), [effectiveId, session.role])

  // The query cache is the source of truth for the board. While the tenant
  // record still persists orders (offline-first reloads), it seeds the cache
  // once, as stale data that is re-read immediately.
  const seedRecord = activeRestaurant.id === effectiveId ? activeRestaurant : undefined
  const boardQuery = useQuery({
    ...ordersQueryOptions(effectiveId, session.role),
    enabled,
    initialData: () =>
      seedRecord && (seedRecord.orders.length > 0 || seedRecord.customers.length > 0)
        ? { orders: seedRecord.orders, customers: seedRecord.customers }
        : undefined,
    initialDataUpdatedAt: 0,
  })
  const board = boardQuery.data
  const orders = board?.orders ?? EMPTY_BOARD.orders
  const customers = board?.customers ?? EMPTY_BOARD.customers

  /** Applies a local change (optimistic write, rollback, SSE event) to the cached board. */
  const updateBoard = useCallback(
    (updater: (current: OrderBoard) => OrderBoard) => {
      queryClient.setQueryData<OrderBoard>(boardKey, (current) => updater(current ?? EMPTY_BOARD))
    },
    [queryClient, boardKey]
  )
  const readBoard = useCallback(
    (): OrderBoard => queryClient.getQueryData<OrderBoard>(boardKey) ?? EMPTY_BOARD,
    [queryClient, boardKey]
  )

  // Dual write: the tenant record keeps a copy of the board (persistence and
  // the consumers that still read it) until it is retired.
  useEffect(() => {
    if (!board || !effectiveId) return
    updateActiveRestaurantRecord((current) =>
      current.orders === board.orders && current.customers === board.customers
        ? current
        : { ...current, orders: board.orders, customers: board.customers }
    )
  }, [board, effectiveId, updateActiveRestaurantRecord])

  // Initial read only: background refetches (SSE catch-up) never flash it.
  const [isRefreshing, setIsRefreshing] = useState(false)
  const isLoadingOrders = isRefreshing || (enabled && boardQuery.isLoading && orders.length === 0)

  // After the LAST in-flight order write settles (the settling mutation counts
  // itself, hence > 1), pull the authoritative server state of every order
  // resource (orders and customers share one key, so none can be skipped).
  // Creations (addOrder and its offline retry) never ask for one: they adopt
  // the server identity from the response and the SSE echo is deduplicated.
  // A failed write never asks for one either: its rollback already restored the
  // pre-write state and nothing changed server-side. A revalidating write that
  // settles while others are in flight leaves the flag set for whichever write
  // settles last.
  const needsRevalidation = useRef(false)
  const revalidate = useCallback(
    (vars: { revalidate?: boolean }, failed: boolean) => {
      if (!failed && vars.revalidate !== false) needsRevalidation.current = true
      if (queryClient.isMutating({ mutationKey: ORDER_WRITES_KEY }) > 1) return
      // A read that landed during the writes was not applied: re-read now.
      if (takeDeferredRead(queryClient, boardKey)) needsRevalidation.current = true
      if (!needsRevalidation.current) return
      needsRevalidation.current = false
      void queryClient.invalidateQueries({ queryKey: keyPrefixes.orders(effectiveId) })
    },
    [queryClient, effectiveId, boardKey]
  )

  const { mutate: trackWrite } = useMutation({
    mutationKey: ORDER_WRITES_KEY,
    mutationFn: (vars: OrderWrite) => vars.request,
    onSuccess: (result, vars) => vars.resolve(result),
    onError: (err, vars) => vars.reject(err),
    onSettled: (_result, err, vars) => revalidate(vars, err !== null),
  })

  // Order edits: onMutate applies the edit to the cache synchronously (the
  // card moves in the same render as the click) after cancelling any read in
  // flight, and keeps the pre-edit board as the context; onError restores it
  // (immediately, also offline: mutations run with networkMode "always");
  // onSettled asks for the single revalidation once the last write settles.
  const { mutateAsync: runEdit } = useMutation({
    mutationKey: ORDER_WRITES_KEY,
    mutationFn: (edit: OrderEdit) => edit.pending ?? Promise.resolve(undefined),
    onMutate: (edit) => {
      void queryClient.cancelQueries({ queryKey: boardKey })
      const snapshot = readBoard()
      updateBoard(edit.apply)
      if (edit.toast.success && edit.toast.successTiming !== "confirmed") {
        toast.success(edit.toast.success)
      } else if (edit.toast.info) {
        toast.info(edit.toast.info)
      }
      return { snapshot }
    },
    onSuccess: (result, edit) => {
      // The server already committed: a reconciliation bug must never roll
      // back or report a failure.
      try {
        if (result && edit.reconcile) updateBoard((board) => edit.reconcile!(board, result))
      } catch (reconcileErr) {
        console.error("OrderContext: onSuccess reconciliation failed", reconcileErr)
      }
      if (edit.toast.success && edit.toast.successTiming === "confirmed") {
        toast.success(edit.toast.success)
      }
    },
    onError: (err, edit, context) => {
      if (edit.skipRollbackIfError?.(err)) return
      if (import.meta.env?.MODE !== "test") console.warn(edit.warnMessage, err)
      if (context) updateBoard((board) => edit.rollback(board, context.snapshot))
      toast.error(edit.toast.error)
    },
    onSettled: (_result, err, edit) => revalidate({ revalidate: edit.pending !== undefined }, err !== null),
  })

  /** Fires the edit's HTTP call at the user action (as before) and runs the edit mutation. */
  const dispatchEdit = useCallback(
    (edit: OrderEdit) => {
      let pending: Promise<any> | undefined
      if (edit.request) {
        try {
          pending = edit.request()
        } catch (err) {
          pending = Promise.reject(err)
        }
        // The mutation owns the rejection; this only avoids a transient
        // unhandled-rejection report before it subscribes.
        pending.catch(() => undefined)
      }
      return runEdit({ ...edit, pending })
    },
    [runEdit]
  )

  /** Tracks an already-dispatched write; settles exactly like the request. */
  const trackRequest = useCallback(
    <T,>(request: Promise<T>, orderId?: string, revalidateOnSettle = true): Promise<T> =>
      new Promise<T>((resolve, reject) => {
        // The mutation owns the rejection; this only avoids a transient
        // unhandled-rejection report before it subscribes.
        request.catch(() => undefined)
        trackWrite({ request, orderId, revalidate: revalidateOnSettle, resolve, reject })
      }),
    [trackWrite]
  )

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
        const orderInput = buildCreateOrderInput({ ...activeRestaurant, customers: readBoard().customers }, order)
        const createdOrder = await trackRequest(apiClient.createOrder(orderInput), undefined, false)
        if (!createdOrder?.id) {
          // Accepted but no body returned: the order is persisted server-side;
          // keep the optimistic card and stop treating it as pending.
          updateBoard((current) => ({
            ...current,
            orders: current.orders.map((o) =>
              o.id === order.id ? { ...o, pendingSync: false } : o
            ),
          }))
          return
        }
        // Adopt the server identity exactly like addOrder's success path
        // (SSE-duplicate collapse included) and clear the pending flag.
        updateBoard((current) => adoptCreatedOrderToActive(current, order.id, createdOrder))
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
        updateBoard((current) => ({
          ...current,
          orders: current.orders.filter((o) => o.id !== order.id),
        }))
        const err = error as any
        const description = formatUserFacingOrderError(
          err && typeof err.message === 'string' ? err.message : undefined
        )
        toast.error(`No se pudo registrar la orden #${order.orderNumber}`, {
          description,
        })
      }
    },
    [activeRestaurant, updateBoard, readBoard, trackRequest]
  )

  const retryPendingOrders = useCallback(async () => {
    const targetRestId = activeRestaurant?.id
    // Anonymous storefront orders are retried too: POST /orders is public and
    // idempotent on clientOrderId, so no session token is required here.
    if (!targetRestId) return
    if (retryInFlightRef.current) return
    const pendingOrders = readBoard().orders.filter((o) => o.pendingSync)
    if (pendingOrders.length === 0) return
    retryInFlightRef.current = true
    try {
      await Promise.all(pendingOrders.map((order) => attemptPendingOrderSync(order)))
    } finally {
      retryInFlightRef.current = false
    }
  }, [activeRestaurant, readBoard, attemptPendingOrderSync])

  // Timer-driven retry for pending orders (covers anonymous storefront
  // customers, who never trigger the token-gated refresh-driven retry). Bounded
  // exponential backoff; an 'online' event retries immediately. After the max
  // attempts it stops and tells the user once; the order stays pending.
  const pendingSyncCount = orders.filter((o) => o.pendingSync).length
  const [retryTick, setRetryTick] = useState(0)
  const retryAttemptsRef = useRef(0)
  const lastPendingCountRef = useRef(0)
  useEffect(() => {
    if (pendingSyncCount === 0) {
      retryAttemptsRef.current = 0
      lastPendingCountRef.current = 0
      return
    }
    if (pendingSyncCount > lastPendingCountRef.current) {
      retryAttemptsRef.current = 0
    }
    lastPendingCountRef.current = pendingSyncCount
    if (retryAttemptsRef.current >= MAX_PENDING_RETRY_ATTEMPTS) return

    const delay = Math.min(
      PENDING_RETRY_BASE_MS * 2 ** retryAttemptsRef.current,
      PENDING_RETRY_MAX_MS
    )
    const run = async () => {
      retryAttemptsRef.current += 1
      await retryPendingOrdersRef.current()
      if (retryAttemptsRef.current >= MAX_PENDING_RETRY_ATTEMPTS) {
        toast.warning(
          'No se pudo sincronizar la orden pendiente. Revisa tu conexión; se reintentará al recargar.'
        )
      }
      setRetryTick((t) => t + 1)
    }
    const timer = setTimeout(() => void run(), delay)
    const onOnline = () => {
      clearTimeout(timer)
      void run()
    }
    window.addEventListener('online', onOnline)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('online', onOnline)
    }
  }, [pendingSyncCount, retryTick])

  // Keep the latest retry callback reachable from the mount/refresh effects
  // without re-running them on every restaurant record identity change.
  useEffect(() => {
    retryPendingOrdersRef.current = retryPendingOrders
  })

  // The first successful read of a tenant proves connectivity: flush the
  // orders held pendingSync during the outage (REJ-02). Only real reads count,
  // not local cache writes.
  const retriedFor = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!effectiveId) return
    const boardHash = hashKey(boardKey)
    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" || event.query.queryHash !== boardHash) return
      if (event.action.type !== "success" || event.action.manual) return
      if (retriedFor.current === effectiveId) return
      retriedFor.current = effectiveId
      void retryPendingOrdersRef.current()
    })
  }, [queryClient, boardKey, effectiveId])

  // Silent catch-up after an SSE reconnect (no loading flag: staff keep working
  // while the board is reconciled). Invalidation refetches the active read once.
  const catchUpOrdersRef = useRef<() => void>(() => {})
  catchUpOrdersRef.current = () => {
    if (!effectiveId || !apiClient.hasToken()) return
    void queryClient.invalidateQueries({ queryKey: keyPrefixes.orders(effectiveId) })
  }

  // Real-time SSE order stream subscription
  useEffect(() => {
    const targetRestId = effectiveId
    if (!targetRestId || !apiClient.hasToken()) return

    const unsubscribe = apiClient.subscribeToOrderStream(
      (event: OrderEvent) => {
        if (!event || !event.orderId) return
        // An order with a pending write keeps its optimistic state: the settle
        // revalidation reconciles it with the server, so a stale echo can
        // never revert it.
        const writePending = queryClient
          .getMutationCache()
          .findAll({ mutationKey: ORDER_WRITES_KEY, status: "pending" })
          .some((m) => (m.state.variables as OrderWrite | undefined)?.orderId === event.orderId)
        if (writePending) return
        updateBoard((current) => updateRestaurantOrderState(current, event))
      },
      targetRestId,
      // Events published while the stream was down are lost: catch up silently.
      () => {
        catchUpOrdersRef.current()
      }
    )

    return () => {
      unsubscribe()
    }
  }, [effectiveId, session, queryClient, updateBoard])

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

      let resolveServer!: (value: ServerOrderResult) => void
      let rejectServer!: (reason?: any) => void
      const serverPromise = new Promise<ServerOrderResult>((res, rej) => {
        resolveServer = res
        rejectServer = rej
      })
      // Attach no-op handler to prevent unhandled rejection if caller does not await serverPromise
      serverPromise.catch(() => {})

      const now = new Date().toISOString()
      const clientOrderId = generateClientOrderId()
      const newOrder: PlacedOrder = {
        ...orderData,
        id: nextTempId("ord"),
        orderNumber: generateSecureOrderNumber(),
        createdAt: now,
        updatedAt: now,
        serverPromise,
      }
      // SUS-19: the correlation id rides on the optimistic Order so the offline
      // retry (attemptPendingOrderSync) rebuilds the input from this same
      // object and re-sends the SAME id — the server replays the first order.
      ;(newOrder as Order & { clientOrderId?: string }).clientOrderId = clientOrderId
      lastSaleAttemptRef.current = { key: attemptKey, at: Date.now(), order: newOrder }

      updateBoard((current) => addOrderToRestaurant(current, newOrder, now))

      if (soundEnabled) {
        playNotificationChime()
      }

      // Backend API integration. The card is optimistic; the outcome toast is
      // only shown once the server answers: success adopts the server identity
      // (temp id -> server id, SSE duplicate collapse), and a rejection shows
      // an error and removes the temporary card so a phantom order is never
      // silently dropped by the next refresh/SSE sync without user visibility.
      try {
        const orderInput = buildCreateOrderInput({ ...activeRestaurant, customers: readBoard().customers }, newOrder)

        trackRequest(apiClient.createOrder(orderInput), undefined, false)
          .then((createdOrder) => {
            const adoptedOrderNumber = createdOrder?.orderNumber ?? newOrder.orderNumber
            if (!createdOrder?.id) {
              // Server accepted but returned no body: keep the optimistic card
              // (it still represents a persisted order) and confirm success.
              toast.success(`Orden #${adoptedOrderNumber} registrada`, {
                description: `${newOrder.customer.nombre} - ${formatCurrency(newOrder.finalTotal)}`,
              })
              resolveServer({ adoptedOrderNumber, createdOrder })
              return
            }
            updateBoard((current) => adoptCreatedOrderToActive(current, newOrder.id, createdOrder))
            toast.success(`Orden #${adoptedOrderNumber} registrada`, {
              description: `${newOrder.customer.nombre} - ${formatCurrency(newOrder.finalTotal)}`,
            })
            resolveServer({ adoptedOrderNumber, createdOrder })
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
              updateBoard((current) => ({
                ...current,
                orders: current.orders.map((o) =>
                  o.id === newOrder.id ? { ...o, pendingSync: true } : o
                ),
              }))
              toast.warning('Sin conexión: la venta quedó guardada localmente y se sincronizará automáticamente')
              resolveServer({ adoptedOrderNumber: newOrder.orderNumber, offline: true })
              return
            }
            if (import.meta.env?.MODE !== 'test') {
              console.warn("Could not sync order to backend API, removing local optimistic order:", error)
            }
            // The server rejected the order (unavailable product, min order,
            // cash below final total, tenant mismatch...): surface it and drop
            // the temporary card instead of pretending the sale succeeded.
            updateBoard((current) => ({
              ...current,
              orders: current.orders.filter((o) => o.id !== newOrder.id),
            }))
            const err = error as any
            const description = formatUserFacingOrderError(
              err && typeof err.message === 'string' ? err.message : undefined
            )
            toast.error(`No se pudo registrar la orden #${newOrder.orderNumber}`, {
              description,
            })
            rejectServer(error)
          })
      } catch (err) {
        if (import.meta.env?.MODE !== 'test') {
          console.warn("Error preparing order input for backend API:", err)
        }
        // Input preparation never reached the server (local condition): treat
        // it like an offline failure and keep the sale pending sync instead of
        // deleting it (REJ-02).
        updateBoard((current) => ({
          ...current,
          orders: current.orders.map((o) =>
            o.id === newOrder.id ? { ...o, pendingSync: true } : o
          ),
        }))
        toast.warning('Sin conexión: la venta quedó guardada localmente y se sincronizará automáticamente')
        resolveServer({ adoptedOrderNumber: newOrder.orderNumber, offline: true })
      }

      return newOrder
    },
    [activeRestaurant, updateBoard, readBoard, soundEnabled, trackRequest]
  )

  const updateOrder = useCallback(
    (orderId: string, updates: Partial<Order>) => {
      const now = new Date().toISOString()
      const targetRestId = activeRestaurant?.id
      const products = activeRestaurant.products ?? []
      return dispatchEdit({
        orderId,
        apply: (board) => ({
          ...board,
          orders: board.orders.map((o) => (o.id === orderId ? { ...o, ...updates, updatedAt: now } : o)),
        }),
        rollback: (board, snapshot) => ({ ...board, orders: snapshot.orders }),
        request:
          apiClient.hasToken() && targetRestId
            ? () => apiClient.updateOrder(orderId, buildUpdateOrderInput(updates, products), targetRestId)
            : undefined,
        reconcile: (board, updatedOrder) => ({
          ...board,
          orders: board.orders.map((o) => (o.id === orderId ? mapBackendOrderToDomain(updatedOrder, o) : o)),
        }),
        toast: {
          success: "Venta actualizada correctamente",
          error: "No se pudo sincronizar la actualización con el servidor",
        },
        warnMessage: "Error al actualizar orden en el servidor:",
      }).then(
        () => undefined,
        () => undefined
      )
    },
    [activeRestaurant, dispatchEdit]
  )

  const updateOrderStatus = useCallback(
    (orderId: string, newStatus: OrderStatus) => {
      const now = new Date().toISOString()
      const restaurantId = activeRestaurant.id
      dispatchEdit({
        orderId,
        apply: (board) => ({
          ...board,
          orders: board.orders.map((o) => (o.id === orderId ? { ...o, status: newStatus, updatedAt: now } : o)),
        }),
        // Only THIS order's previous status is restored (a whole-list snapshot
        // would wipe SSE-added orders), and only while it still holds our
        // value: if another update (SSE) moved it elsewhere, leave it alone.
        rollback: (board, snapshot) => {
          const previous = snapshot.orders.find((o) => o.id === orderId)
          return {
            ...board,
            orders: board.orders.map((o) =>
              o.id === orderId && previous && o.status === newStatus
                ? { ...o, status: previous.status, updatedAt: previous.updatedAt ?? o.updatedAt }
                : o
            ),
          }
        },
        request: () => apiClient.updateOrderStatus(orderId, newStatus, restaurantId),
        toast: {
          info: `Orden actualizada a: ${newStatus.toUpperCase()}`,
          error: `No se pudo actualizar la orden a: ${newStatus.toUpperCase()}`,
        },
        warnMessage: `Could not sync status update for order ${orderId} to backend API:`,
      }).catch(() => undefined)
    },
    [activeRestaurant.id, dispatchEdit]
  )

  const updateOrderReceipt = useCallback(
    (orderId: string, receiptUrl: string) => {
      const now = new Date().toISOString()
      const restaurantId = activeRestaurant.id
      return dispatchEdit({
        orderId,
        apply: (board) => ({
          ...board,
          orders: board.orders.map((o) => (o.id === orderId ? { ...o, receiptUrl, updatedAt: now } : o)),
        }),
        rollback: (board, snapshot) => {
          const previous = snapshot.orders.find((o) => o.id === orderId)
          return {
            ...board,
            orders: board.orders.map((o) =>
              o.id === orderId && o.receiptUrl === receiptUrl
                ? { ...o, receiptUrl: previous?.receiptUrl, updatedAt: previous?.updatedAt ?? o.updatedAt }
                : o
            ),
          }
        },
        request: () => apiClient.updateOrderReceipt(orderId, receiptUrl, restaurantId),
        toast: {
          success: "Comprobante adjuntado correctamente",
          successTiming: "confirmed",
          error: "No se pudo adjuntar el comprobante",
        },
        warnMessage: `Could not sync receipt update for order ${orderId} to backend API:`,
        // Callers must know the attach failed (they would otherwise report success).
      }).then(() => undefined)
    },
    [activeRestaurant.id, dispatchEdit]
  )

  const deleteOrder = useCallback(
    (orderId: string) => {
      const targetRestId = activeRestaurant?.id
      return dispatchEdit({
        orderId,
        apply: (board) => ({ ...board, orders: board.orders.filter((o) => o.id !== orderId) }),
        rollback: (board, snapshot) => ({ ...board, orders: snapshot.orders }),
        request:
          apiClient.hasToken() && targetRestId ? () => apiClient.deleteOrder(orderId, targetRestId) : undefined,
        toast: { success: "Orden eliminada", error: "No se pudo eliminar la orden del servidor" },
        skipRollbackIfError: isNotFoundError,
        warnMessage: "Error al eliminar orden del servidor:",
      }).then(
        () => undefined,
        () => undefined
      )
    },
    [activeRestaurant?.id, dispatchEdit]
  )

  const updateCustomer = useCallback(
    (id: string, updates: Partial<Customer>) => {
      const targetRestId = activeRestaurant?.id
      const updateInput: UpdateCustomerInput = {}
      if (updates.nombre !== undefined) updateInput.name = updates.nombre
      if (updates.telefono !== undefined) updateInput.phone = updates.telefono
      if (updates.direccion !== undefined) updateInput.address = updates.direccion
      if (updates.barrio !== undefined) updateInput.barrio = updates.barrio
      if (updates.notes !== undefined) updateInput.notes = updates.notes

      return dispatchEdit({
        apply: (board) => ({
          ...board,
          customers: board.customers.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        }),
        rollback: (board, snapshot) => ({ ...board, customers: snapshot.customers }),
        request:
          apiClient.hasToken() && targetRestId
            ? () => apiClient.updateCustomer(id, updateInput, targetRestId)
            : undefined,
        reconcile: (board, updatedCustomer) => ({
          ...board,
          customers: board.customers.map((c) =>
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
        }),
        toast: {
          success: "Ficha del cliente actualizada",
          error: "No se pudo sincronizar el cliente con el servidor",
        },
        warnMessage: "Error al actualizar cliente en el servidor:",
      }).then(
        () => undefined,
        () => undefined
      )
    },
    [activeRestaurant?.id, dispatchEdit]
  )

  const refreshOrders = useCallback(async () => {
    const targetRestId = effectiveId
    if (!targetRestId || !apiClient.hasToken()) return
    setIsRefreshing(true)
    try {
      // staleTime 0: an explicit refresh always asks the server (concurrent
      // reads share the request in flight); the result lands in the cache
      // before the pending-order retry adopts server identities.
      await queryClient.fetchQuery({
        ...ordersQueryOptions(targetRestId, session.role),
        staleTime: 0,
      })
      // A successful refresh proves connectivity: flush offline-created orders
      // held as pendingSync (REJ-02).
      await retryPendingOrders()
    } catch (err) {
      if (import.meta.env?.MODE !== 'test') {
        console.warn("Could not refresh orders from backend API:", err)
      }
    } finally {
      setIsRefreshing(false)
    }
  }, [effectiveId, session.role, queryClient, retryPendingOrders])

  const pendingOrdersCount = useMemo(() => {
    return orders.filter((o) => o.status === "pending").length
  }, [orders])

  const value: OrderContextType = useMemo(
    () => ({
      orders,
      addOrder,
      updateOrder,
      updateOrderStatus,
      updateOrderReceipt,
      deleteOrder,
      customers,
      updateCustomer,
      pendingOrdersCount,
      isLoadingOrders,
      refreshOrders,
    }),
    [
      orders,
      addOrder,
      updateOrder,
      updateOrderStatus,
      updateOrderReceipt,
      deleteOrder,
      customers,
      updateCustomer,
      pendingOrdersCount,
      isLoadingOrders,
      refreshOrders,
    ]
  )

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>
}

export const useOrders = (): OrderContextType => {
  const context = useContext(OrderContext)
  if (!context) {
    throw new Error("useOrders must be used within an OrderProvider")
  }
  return context
}
