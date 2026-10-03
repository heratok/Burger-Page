/**
 * Top-level paths that belong to the admin backoffice, not to a tenant
 * storefront. Single source of truth for `resolveRoute` and for code that must
 * tell a storefront slug apart from a backoffice route (e.g. TenantContext).
 */
export const ADMIN_ROOT_PATHS: readonly string[] = ["admin", "login", "signin", "auth"]
