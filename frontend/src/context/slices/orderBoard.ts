import { hashKey, type QueryClient, type QueryKey } from "@tanstack/react-query"
import type { Order, OrderStatus, Customer } from "@/types/restaurant"
import { calculateLineItemTotal } from "@/features/cart/cartEngine"
import { cleanPhoneNumber } from "@/lib/utils"

/**
 * The order board of one tenant as cached under keys.orders(tenantId, role):
 * domain orders plus the customer directory derived from them. Every order
 * read, optimistic write and SSE event goes through this one cache entry.
 */
export interface OrderBoard {
  orders: Order[]
  customers: Customer[]
}

/** Raw read of the board endpoints (orders + customers), before mapping. */
export interface BackendBoard {
  orders: any[]
  customers: any[]
}

export const EMPTY_BOARD: OrderBoard = { orders: [], customers: [] }

// Shared key so a settling write can tell whether other order-slice writes are
// still in flight (every write kind shares it; see OrderProvider's revalidate).
export const ORDER_WRITES_KEY = ["order-writes"] as const

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

export function computeLoyaltyTier(totalOrders: number, totalSpent?: number): Customer["loyaltyTier"] {
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

export function mapBackendOrderToDomain(bo: any, existing?: Order, matchedCustomer?: any): Order {
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
    // The server is the source of truth for the table: an absent field means
    // "no table" (detached), never "keep the previous local value".
    ...(bo.tableId ? { tableId: bo.tableId as string } : {}),
    ...(bo.tableLabel ? { tableLabel: bo.tableLabel as string } : {}),
    status: (bo.status as OrderStatus) || existing?.status || 'pending',
    createdAt: bo.createdAt || existing?.createdAt || new Date().toISOString(),
    updatedAt: bo.updatedAt || existing?.updatedAt || new Date().toISOString(),
  }
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

    const matchedOrders = nextOrders.filter(
      (o) => cleanPhoneNumber(o.customer.telefono) === cleanPhone
    )
    // Same rule as the DB trigger update_customer_order_metrics: cancelled
    // orders never count toward orders/spent/last order/loyalty.
    const custOrders = matchedOrders.filter((o) => o.status !== "cancelled")
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
      // Keep the stored figures only when no order of this customer is loaded at
      // all; a customer whose loaded orders are all cancelled really has zero.
      totalOrders: matchedOrders.length > 0 ? totalOrders : existing?.totalOrders || 0,
      totalSpent: matchedOrders.length > 0 ? totalSpent : existing?.totalSpent || 0,
      lastOrderDate,
      loyaltyTier,
      notes: bc.notes ?? existing?.notes ?? "",
    })
  })

  return Array.from(customersMap.values())
}

// Reads that landed while an order write was in flight, per client: they were
// not applied (see reconcileOrderBoard) and must be re-read once writes settle.
const deferredReads = new WeakMap<QueryClient, Set<string>>()

/** True (once) when a read of this tenant's board was deferred by a pending write. */
export function takeDeferredRead(client: QueryClient, queryKey: QueryKey): boolean {
  const set = deferredReads.get(client)
  const hash = hashKey(queryKey)
  if (!set?.has(hash)) return false
  set.delete(hash)
  return true
}

/**
 * Turns a server read into the cached board, merged with what is cached now
 * (server fields win, local fallbacks fill the gaps, pendingSync sales stay).
 * A response that lands while an order write is in flight predates it and
 * would wipe its optimistic state: the cached board is kept as is and the read
 * is remembered, so the last settling write revalidates.
 */
export function reconcileOrderBoard(
  client: QueryClient,
  queryKey: QueryKey,
  raw: BackendBoard
): OrderBoard {
  const current = client.getQueryData<OrderBoard>(queryKey)
  if (current && client.isMutating({ mutationKey: ORDER_WRITES_KEY }) > 0) {
    const set = deferredReads.get(client) ?? new Set<string>()
    set.add(hashKey(queryKey))
    deferredReads.set(client, set)
    return current
  }
  const base = current ?? EMPTY_BOARD
  const orders = syncBackendOrders(base.orders, raw.orders, base.customers)
  return { orders, customers: syncBackendCustomers(base.customers, raw.customers, orders) }
}
