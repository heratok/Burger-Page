import { useCallback, useMemo } from "react"
import { useQueries, type QueryObserverResult } from "@tanstack/react-query"
import type { AdditionItem, MenuItem, Order } from "@/types/restaurant"
import { ordersQueryOptions, productsQueryOptions, additionsQueryOptions } from "@/core/query/options"
import { useTenant } from "./TenantContext"
import { useAuth } from "./AuthContext"
import type { OrderBoard } from "./orderBoard"

export interface GlobalPlatformStats {
  totalRevenue: number
  totalOrders: number
  totalRestaurants: number
  activeRestaurants: number
  totalCustomers: number
}

/**
 * The cached order board of every restaurant in the directory, for the
 * current role. Read-only: it never fetches (enabled: false), it only follows
 * the boards this session has already read or written, so it is exactly as
 * complete as what has been loaded. Only platform screens use it; the tenant
 * context stays untouched by order activity.
 */
export function useOrderBoardsByTenant(): Map<string, OrderBoard> {
  const { restaurants } = useTenant()
  const { session } = useAuth()
  // Stable while the directory's ids are the same (the records change often).
  const idsKey = restaurants.map((r) => r.id).join("|")
  const ids = useMemo(() => (idsKey ? idsKey.split("|") : []), [idsKey])
  const combine = useCallback(
    (results: QueryObserverResult<OrderBoard>[]) => {
      const boards = new Map<string, OrderBoard>()
      results.forEach((result, i) => {
        if (result.data) boards.set(ids[i], result.data)
      })
      return boards
    },
    [ids]
  )
  return useQueries({
    queries: ids.map((id) => ({ ...ordersQueryOptions(id, session.role), enabled: false })),
    combine,
  })
}

export interface CatalogSize {
  products: number
  additions: number
}

/**
 * Catalog sizes of every restaurant in the directory, from the cached product
 * and addition lists this session has read (read-only, never fetches).
 */
export function useCatalogSizesByTenant(): Map<string, CatalogSize> {
  const { restaurants } = useTenant()
  const { session } = useAuth()
  const targetsKey = restaurants.map((r) => `${r.id}\u0000${r.slug}`).join("|")
  const targets = useMemo(
    () => (targetsKey ? targetsKey.split("|").map((t) => t.split("\u0000") as [string, string]) : []),
    [targetsKey]
  )
  const combine = useCallback(
    (results: QueryObserverResult<MenuItem[] | AdditionItem[]>[]) => {
      const sizes = new Map<string, CatalogSize>()
      targets.forEach(([id], i) => {
        const products = results[i * 2]?.data
        const additions = results[i * 2 + 1]?.data
        if (products || additions) {
          sizes.set(id, { products: products?.length ?? 0, additions: additions?.length ?? 0 })
        }
      })
      return sizes
    },
    [targets]
  )
  return useQueries({
    queries: targets.flatMap(([id, slug]) => [
      { ...productsQueryOptions(id, session.role, slug), enabled: false },
      { ...additionsQueryOptions(id, session.role, slug), enabled: false },
    ]),
    combine,
  })
}

/** Orders of one restaurant as far as this session has read them. */
export const ordersOf = (boards: Map<string, OrderBoard>, restaurantId: string): Order[] =>
  boards.get(restaurantId)?.orders ?? []

/** Platform totals: directory counts plus the order boards read in this session. */
export function useGlobalStats(): GlobalPlatformStats {
  const { restaurants } = useTenant()
  const boards = useOrderBoardsByTenant()

  return useMemo(() => {
    let totalRevenue = 0
    let totalOrders = 0
    let totalCustomers = 0
    boards.forEach((board) => {
      totalRevenue += board.orders
        .filter((o) => o.status !== "cancelled")
        .reduce((sum, o) => sum + (o.finalTotal || 0), 0)
      totalOrders += board.orders.length
      totalCustomers += board.customers.length
    })
    return {
      totalRevenue,
      totalOrders,
      totalRestaurants: restaurants.length,
      activeRestaurants: restaurants.filter((r) => r.isActive).length,
      totalCustomers,
    }
  }, [boards, restaurants])
}
