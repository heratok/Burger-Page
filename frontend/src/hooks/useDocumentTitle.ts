import { useEffect } from "react"
import type { AdminSession, AdminTab, AppView } from "@/types/restaurant"

/** Tab title for platform-level views (landing, login, super admin modules). */
export const PLATFORM_TITLE = "FoodOS"

/** Id of the placeholder tenant TenantContext exposes until the real one loads. */
const PLACEHOLDER_RESTAURANT_ID = "rest-default"

const GLOBAL_ADMIN_TABS: ReadonlySet<AdminTab> = new Set(["restaurants", "users", "metrics", "audit"])

export interface TitleRouteState {
  activeView: AppView
  isNotFound: boolean
  isResolving: boolean
  sessionRole: AdminSession["role"]
  adminTab: AdminTab
  restaurantId: string
  restaurantName: string
}

/**
 * Restaurant name the tab should show, or undefined for platform views:
 * landing, not-found, a slug still resolving, the admin login, the global
 * super admin modules, and any moment the real tenant is not loaded yet.
 */
export function selectTitleRestaurantName(state: TitleRouteState): string | undefined {
  if (state.restaurantId === PLACEHOLDER_RESTAURANT_ID) return undefined
  if (state.isNotFound) return undefined

  if (state.activeView === "store") {
    return state.isResolving ? undefined : state.restaurantName
  }
  if (state.activeView === "admin") {
    if (state.sessionRole === "guest") return undefined
    if (GLOBAL_ADMIN_TABS.has(state.adminTab)) return undefined
    return state.restaurantName
  }
  return undefined
}

export function resolveDocumentTitle(restaurantName: string | undefined): string {
  const trimmed = restaurantName?.trim()
  return trimmed ? trimmed : PLATFORM_TITLE
}

/**
 * Keeps the browser tab title in sync with the active restaurant, so every
 * tenant shows its own name instead of a hardcoded brand from index.html.
 */
export function useDocumentTitle(restaurantName: string | undefined): void {
  const title = resolveDocumentTitle(restaurantName)
  useEffect(() => {
    document.title = title
  }, [title])

  useEffect(() => {
    return () => {
      document.title = PLATFORM_TITLE
    }
  }, [])
}
