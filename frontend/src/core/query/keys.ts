import type { UserRole } from "@/types/restaurant"

/**
 * Single source of every TanStack Query key. Tenant isolation rule: every
 * tenant-scoped key carries the effective tenant id AND the session role, so a
 * cache entry is never served across tenants or roles (logout clears the whole
 * client on top of that). The tenant slot is kept even while it is unknown
 * (disabled queries), so key shapes never shift.
 */
type TenantId = string | undefined

export const keys = {
  orders: (tenantId: TenantId, role: UserRole) => ["orders", tenantId, role] as const,
  products: (tenantId: TenantId, role: UserRole, slug: string | undefined) =>
    ["products", tenantId, role, slug] as const,
  additions: (tenantId: TenantId, role: UserRole, slug: string | undefined) =>
    ["additions", tenantId, role, slug] as const,
  inventory: (tenantId: TenantId, role: UserRole) => ["inventory", tenantId, role] as const,
  suppliers: (tenantId: TenantId, role: UserRole) => ["suppliers", tenantId, role] as const,
  tables: (tenantId: TenantId, role: UserRole) => ["tables", tenantId, role] as const,
  restaurants: (role: UserRole) => ["restaurants", role] as const,
  restaurant: (role: UserRole, idOrSlug: string) => ["restaurant", role, idOrSlug] as const,
  restaurantStatus: (role: UserRole, slug: string) => ["restaurant-status", role, slug] as const,
  /** Soft-deleted restaurants (super admin restore tab). */
  deletedRestaurants: (role: UserRole) => ["deleted-restaurants", role] as const,
  /** Platform audit log (super admin); one entry per filter combination. */
  auditLog: (role: UserRole, filters: Record<string, string | undefined>) =>
    ["audit-log", role, filters] as const,
  /** Platform users (super admin); scoped to one restaurant when an id is given. */
  users: (role: UserRole, restaurantId?: string) =>
    (restaurantId === undefined ? ["users", role] : ["users", role, restaurantId]) as readonly unknown[],
}

/** Prefixes for invalidateQueries/isFetching: every key of one resource (and tenant). */
export const keyPrefixes = {
  orders: (tenantId: TenantId) => ["orders", tenantId] as const,
  products: (tenantId: TenantId) => ["products", tenantId] as const,
  additions: (tenantId: TenantId) => ["additions", tenantId] as const,
  inventory: (tenantId: TenantId) => ["inventory", tenantId] as const,
  suppliers: (tenantId: TenantId) => ["suppliers", tenantId] as const,
  tables: (tenantId: TenantId) => ["tables", tenantId] as const,
  restaurants: () => ["restaurants"] as const,
  restaurant: () => ["restaurant"] as const,
  restaurantStatus: () => ["restaurant-status"] as const,
  deletedRestaurants: () => ["deleted-restaurants"] as const,
  users: () => ["users"] as const,
  auditLog: () => ["audit-log"] as const,
}
