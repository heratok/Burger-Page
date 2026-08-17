import { createContext, useContext } from "react"

/**
 * Mode-aware admin session (design D4, spec AD-1): the session records WHO is
 * logged in — a super-admin or the admin of ONE restaurant — and lives in
 * sessionStorage, surviving reloads but dying with the tab. The legacy single
 * boolean grant (`burger-page:admin-granted`) migrates into a restaurant-mode
 * session for the first restaurant during the transition.
 */

/** Super-admin grant key (read by the P6 super portal gate). */
export const SUPER_ADMIN_GRANT_KEY = "burger-page:superadmin-granted"

/** Legacy single boolean grant from the v1 admin (kept for the transition). */
export const LEGACY_ADMIN_GRANT_KEY = "burger-page:admin-granted"

/** Backwards-compatible alias for the legacy key. */
export const ADMIN_GRANT_KEY = LEGACY_ADMIN_GRANT_KEY

/** Prefix for per-restaurant grant keys: `burger-page:admin-granted:{id}`. */
export const ADMIN_GRANT_KEY_PREFIX = "burger-page:admin-granted:"

export type AdminMode = "super" | "restaurant"

/** Who is logged in and, for restaurant mode, at which restaurant. */
export type AdminSession =
  | { mode: "super" }
  | { mode: "restaurant"; restaurantId: string }

/** Session grant key for a specific restaurant. */
export function adminGrantKey(restaurantId: string): string {
  return `${ADMIN_GRANT_KEY_PREFIX}${restaurantId}`
}

/** Pure grant check: does this session open the requested scope? (AD-1 Scoped) */
export function sessionMatches(
  session: AdminSession | null,
  mode: AdminMode,
  restaurantId?: string
): boolean {
  if (session === null) return false
  if (session.mode === "super") return mode === "super"
  if (mode === "super") return false
  return session.restaurantId === restaurantId
}

/** Rebuilds the session from sessionStorage; the legacy grant maps to the first restaurant. */
export function readStoredSession(
  store: Storage,
  defaultRestaurantId?: string
): AdminSession | null {
  if (store.getItem(SUPER_ADMIN_GRANT_KEY) === "1") return { mode: "super" }
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i)
    if (key !== null && key.startsWith(ADMIN_GRANT_KEY_PREFIX)) {
      const restaurantId = key.slice(ADMIN_GRANT_KEY_PREFIX.length)
      if (restaurantId !== "" && store.getItem(key) === "1") {
        return { mode: "restaurant", restaurantId }
      }
    }
  }
  if (
    defaultRestaurantId !== undefined &&
    store.getItem(LEGACY_ADMIN_GRANT_KEY) === "1"
  ) {
    return { mode: "restaurant", restaurantId: defaultRestaurantId }
  }
  return null
}

/** Removes every grant key (single active session; logout). */
export function clearStoredSession(store: Storage): void {
  for (let i = store.length - 1; i >= 0; i--) {
    const key = store.key(i)
    if (
      key !== null &&
      (key === SUPER_ADMIN_GRANT_KEY ||
        key === LEGACY_ADMIN_GRANT_KEY ||
        key.startsWith(ADMIN_GRANT_KEY_PREFIX))
    ) {
      store.removeItem(key)
    }
  }
}

export interface AdminContextValue {
  session: AdminSession | null
  login: (mode: AdminMode, restaurantId?: string) => void
  logout: () => void
}

export const AdminContext = createContext<AdminContextValue | null>(null)

export function useAdmin(): AdminContextValue {
  const context = useContext(AdminContext)
  if (context === null) {
    throw new Error("useAdmin must be used within an AdminProvider")
  }
  return context
}