import { queryOptions, type QueryClient, type QueryKey } from "@tanstack/react-query"
import type { AdditionItem, MenuItem, RestaurantRecord, UserRole } from "@/types/restaurant"
import { apiClient } from "@/core/api/apiClient"
import { keys } from "./keys"
import { PERSIST_MAX_AGE } from "./persistence"
import { reconcileOrderBoard, type BackendBoard, type OrderBoard } from "@/context/slices/orderBoard"
import { seedDirectory, toRestaurantRecord } from "@/context/slices/restaurantCache"
import { deferRead } from "./deferredReads"

/**
 * Per-resource query options: the key, the fetcher and the options every read
 * of that resource shares. Call sites add only what is theirs (enabled,
 * staleTime for explicit refreshes). Tenant reads never retry: the slices own
 * their refresh points (login, tenant switch, post-write revalidation).
 */
type TenantId = string | undefined

/**
 * Guest storefront reads are persisted for offline reloads: they stay in the
 * cache as long as the persisted copy may be restored (24h), so an unobserved
 * one is not garbage-collected out of the persisted snapshot.
 */
const storefrontGcTime = (role: UserRole) => (role === "guest" ? { gcTime: PERSIST_MAX_AGE } : {})

const warn = (message: string, err: unknown) => {
  if (import.meta.env?.MODE !== "test") {
    console.warn(message, err)
  }
}

/** Logs a failed read (outside tests) and rethrows it so the query errors. */
async function logged<T>(message: string, read: () => Promise<T>): Promise<T> {
  try {
    return await read()
  } catch (err) {
    warn(message, err)
    throw err
  }
}

/**
 * Reads the order board: orders plus customers. A failed customers read falls
 * back to an empty list (orders still hydrate); a failed orders read rejects.
 */
async function fetchBoard(restaurantId: string): Promise<BackendBoard> {
  return logged("Could not fetch orders/customers from backend API:", async () => {
    const [orders, customers] = await Promise.all([
      apiClient.fetchOrders(restaurantId),
      apiClient.fetchCustomers(restaurantId).catch((err) => {
        warn("Could not fetch customers from backend API:", err)
        return [] as any[]
      }),
    ])
    return { orders: Array.isArray(orders) ? [...orders] : (orders as any), customers: [...customers] }
  })
}

// Orders and customers are one resource: customer metrics are derived from the
// synced orders, so both are read together and cached as one domain board,
// merged with what is cached (see reconcileOrderBoard). Structural sharing
// keeps the identity of every order a refetch did not change. networkMode
// "always": the board is read even when navigator.onLine says otherwise (the
// fetch itself decides).
export const ordersQueryOptions = (tenantId: TenantId, role: UserRole) =>
  queryOptions({
    queryKey: keys.orders(tenantId, role),
    queryFn: async ({ client, queryKey }): Promise<OrderBoard> =>
      reconcileOrderBoard(client, queryKey, await fetchBoard(tenantId as string)),
    retry: false,
    networkMode: "always",
  })

/**
 * Shared key of every write to tenant records (restaurant edits, store
 * config): a directory read that lands while one is pending is deferred.
 */
export const TENANT_WRITES_KEY = ["tenant-writes"] as const

/** Shared key of every catalog write (products, additions, categories). */
export const CATALOG_WRITES_KEY = ["catalog-writes"] as const

/**
 * A catalog read that lands while a catalog write is in flight predates it and
 * would wipe its optimistic state: the cached list is kept (the last settling
 * write always revalidates the catalog).
 */
function keepCachedDuringWrites<T>(client: QueryClient, queryKey: QueryKey, fresh: T): T {
  if (client.isMutating({ mutationKey: CATALOG_WRITES_KEY }) === 0) return fresh
  const cached = client.getQueryData<T>(queryKey)
  return cached === undefined ? fresh : cached
}

export const productsQueryOptions = (tenantId: TenantId, role: UserRole, slug: string | undefined) =>
  queryOptions({
    queryKey: keys.products(tenantId, role, slug),
    ...storefrontGcTime(role),
    queryFn: async ({ client, queryKey }): Promise<MenuItem[]> =>
      keepCachedDuringWrites(
        client,
        queryKey,
        await logged("Could not fetch products from backend API:", () =>
          apiClient.fetchProducts({ restaurantId: tenantId, slug })
        )
      ),
    retry: false,
  })

export const additionsQueryOptions = (tenantId: TenantId, role: UserRole, slug: string | undefined) =>
  queryOptions({
    queryKey: keys.additions(tenantId, role, slug),
    ...storefrontGcTime(role),
    queryFn: async ({ client, queryKey }): Promise<AdditionItem[]> =>
      keepCachedDuringWrites(
        client,
        queryKey,
        await logged("Could not fetch additions from backend API:", () =>
          apiClient.fetchAdditions({ restaurantId: tenantId, slug })
        )
      ),
    retry: false,
  })

export const inventoryQueryOptions = (tenantId: TenantId, role: UserRole) =>
  queryOptions({
    queryKey: keys.inventory(tenantId, role),
    queryFn: () =>
      logged("Could not fetch inventory from backend API:", () => apiClient.fetchInventory(tenantId)),
    retry: false,
  })

export const suppliersQueryOptions = (tenantId: TenantId, role: UserRole) =>
  queryOptions({
    queryKey: keys.suppliers(tenantId, role),
    queryFn: () =>
      logged("Could not fetch suppliers from backend API:", () => apiClient.fetchSuppliers(tenantId)),
    retry: false,
  })

/**
 * Private platform directory (admin-only), as domain records. Each read seeds
 * the keys.restaurant entry of every listed restaurant. A read that lands while
 * a tenant write is pending predates it: the cached directory is kept and the
 * read is remembered, so the last settling write re-reads it once.
 */
export const restaurantsQueryOptions = (role: UserRole) =>
  queryOptions({
    queryKey: keys.restaurants(role),
    queryFn: async ({ client, queryKey }): Promise<RestaurantRecord[]> => {
      const backend = await apiClient.listRestaurants()
      const cached = client.getQueryData<RestaurantRecord[]>(queryKey)
      if (!Array.isArray(backend)) return cached ?? []
      if (cached && client.isMutating({ mutationKey: TENANT_WRITES_KEY }) > 0) {
        deferRead(client, queryKey)
        return cached
      }
      return seedDirectory(client, role, backend)
    },
  })

/** Public by-slug/id tenant lookup, as a domain record (null when the API answers nothing). */
export const restaurantQueryOptions = (role: UserRole, idOrSlug: string) =>
  queryOptions({
    queryKey: keys.restaurant(role, idOrSlug),
    ...storefrontGcTime(role),
    queryFn: async ({ client, queryKey }): Promise<RestaurantRecord | null> => {
      const fetched = await apiClient.fetchRestaurant(idOrSlug)
      return fetched ? toRestaurantRecord(fetched, client.getQueryData<RestaurantRecord>(queryKey) ?? undefined) : null
    },
  })

/** Storefront status poll (schedule, timezone, pause) through the public endpoint. */
export const restaurantStatusQueryOptions = (role: UserRole, slug: string) =>
  queryOptions({
    queryKey: keys.restaurantStatus(role, slug),
    queryFn: async () => (await apiClient.fetchRestaurant(slug)) ?? null,
  })
