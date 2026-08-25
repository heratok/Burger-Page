import { useState, useEffect, useCallback } from "react"
import type { RestaurantRecord, AppView, AdminTab } from "@/types/restaurant"
import { useRestaurant } from "@/context/RestaurantContext"

export interface RouteResolution {
  view: AppView
  adminTab?: AdminTab
  restaurantId?: string
  attemptedSlug?: string
  isNotFound: boolean
}

export const VALID_ADMIN_TABS: AdminTab[] = [
  "dashboard",
  "orders",
  "menu",
  "inventory",
  "customers",
  "reports",
  "customizer",
  "restaurants",
]

/**
 * Pure route resolution function mapping a URL pathname to the appropriate view, sub-tab & tenant.
 */
export function resolveRoute(
  pathname: string,
  restaurants: RestaurantRecord[]
): RouteResolution {
  const cleanPath = pathname.replace(/^\/+|\/+$/g, "")
  const lowerPath = cleanPath.toLowerCase()

  if (!lowerPath) {
    return {
      view: "landing",
      isNotFound: false,
    }
  }

  // Exact /admin root backoffice path
  if (lowerPath === "admin") {
    return {
      view: "admin",
      isNotFound: false,
    }
  }

  // Sub-routes for admin backoffice (e.g. /admin/orders, /admin/menu, /admin/dashboard)
  if (lowerPath.startsWith("admin/")) {
    const subTab = lowerPath.slice("admin/".length)
    if (VALID_ADMIN_TABS.includes(subTab as AdminTab)) {
      return {
        view: "admin",
        adminTab: subTab as AdminTab,
        isNotFound: false,
      }
    }
  }

  const matched = restaurants.find(
    (r) => r.slug.toLowerCase() === lowerPath
  )

  if (matched) {
    return {
      view: "store",
      restaurantId: matched.id,
      isNotFound: false,
    }
  }

  return {
    view: "not-found",
    attemptedSlug: cleanPath,
    isNotFound: true,
  }
}

/**
 * Custom router hook managing browser history, path syncing, deep-linking, and tenant switching.
 */
export function useAppRouter() {
  const {
    restaurants,
    switchRestaurant,
    setActiveView,
    activeView,
    adminTab,
    setAdminTab,
  } = useRestaurant()
  const [attemptedSlug, setAttemptedSlug] = useState<string | null>(null)
  const [isNotFound, setIsNotFound] = useState(false)

  const syncLocation = useCallback(() => {
    const resolution = resolveRoute(window.location.pathname, restaurants)

    if (resolution.isNotFound) {
      setAttemptedSlug(resolution.attemptedSlug ?? null)
      setIsNotFound(true)
      setActiveView("not-found")
    } else {
      setIsNotFound(false)
      setAttemptedSlug(null)
      if (resolution.restaurantId) {
        switchRestaurant(resolution.restaurantId)
      }
      if (resolution.adminTab) {
        setAdminTab(resolution.adminTab)
      }
      setActiveView(resolution.view)
    }
  }, [restaurants, switchRestaurant, setActiveView, setAdminTab])

  useEffect(() => {
    syncLocation()
    window.addEventListener("popstate", syncLocation)
    return () => window.removeEventListener("popstate", syncLocation)
  }, [syncLocation])

  const navigateTo = useCallback(
    (path: string) => {
      window.history.pushState({}, "", path)
      syncLocation()
    },
    [syncLocation]
  )

  return {
    activeView,
    adminTab,
    isNotFound,
    attemptedSlug,
    navigateTo,
  }
}
