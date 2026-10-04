import { queryOptions } from "@tanstack/react-query"
import type { UserRole } from "@/types/restaurant"
import { apiClient } from "@/core/api/apiClient"
import { keys } from "./keys"

/**
 * Per-resource query options: the key, the fetcher and the options every read
 * of that resource shares. Call sites add only what is theirs (enabled,
 * staleTime for explicit refreshes). Tenant reads never retry: the slices own
 * their refresh points (login, tenant switch, post-write revalidation).
 */
type TenantId = string | undefined

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

export interface Board {
  orders: any[]
  customers: any[]
}

/**
 * Reads the order board: orders plus customers. A failed customers read falls
 * back to an empty list (orders still hydrate); a failed orders read rejects.
 */
async function fetchBoard(restaurantId: string): Promise<Board> {
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
// synced orders, so both are read together and hydrate atomically. Returning a
// fresh object per fetch (structural sharing off) lets every successful fetch
// re-hydrate the tenant record. networkMode "always": the board is read even
// when navigator.onLine says otherwise (the fetch itself decides).
export const ordersQueryOptions = (tenantId: TenantId, role: UserRole) =>
  queryOptions({
    queryKey: keys.orders(tenantId, role),
    queryFn: () => fetchBoard(tenantId as string),
    retry: false,
    structuralSharing: false,
    networkMode: "always",
  })

export const productsQueryOptions = (tenantId: TenantId, role: UserRole, slug: string | undefined) =>
  queryOptions({
    queryKey: keys.products(tenantId, role, slug),
    queryFn: () =>
      logged("Could not fetch products from backend API:", () =>
        apiClient.fetchProducts({ restaurantId: tenantId, slug })
      ),
    retry: false,
  })

export const additionsQueryOptions = (tenantId: TenantId, role: UserRole, slug: string | undefined) =>
  queryOptions({
    queryKey: keys.additions(tenantId, role, slug),
    queryFn: () =>
      logged("Could not fetch additions from backend API:", () =>
        apiClient.fetchAdditions({ restaurantId: tenantId, slug })
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

/** Private platform directory (admin-only). */
export const restaurantsQueryOptions = (role: UserRole) =>
  queryOptions({
    queryKey: keys.restaurants(role),
    queryFn: async () => (await apiClient.listRestaurants()) ?? null,
  })

/** Public by-slug/id tenant lookup. */
export const restaurantQueryOptions = (role: UserRole, idOrSlug: string) =>
  queryOptions({
    queryKey: keys.restaurant(role, idOrSlug),
    queryFn: async () => (await apiClient.fetchRestaurant(idOrSlug)) ?? null,
  })

/** Storefront status poll (schedule, timezone, pause) through the public endpoint. */
export const restaurantStatusQueryOptions = (role: UserRole, slug: string) =>
  queryOptions({
    queryKey: keys.restaurantStatus(role, slug),
    queryFn: async () => (await apiClient.fetchRestaurant(slug)) ?? null,
  })
