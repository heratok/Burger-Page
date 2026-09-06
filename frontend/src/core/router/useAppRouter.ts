import { useState, useEffect, useCallback } from "react"
import type { RestaurantRecord, AppView, AdminTab } from "@/types/restaurant"
import { useRestaurant } from "@/context/RestaurantContext"
import { apiClient } from "@/core/api/apiClient"

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
  "users",
  "metrics",
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

  // Exact /admin, /login, /signin root backoffice path
  if (["admin", "login", "signin", "auth"].includes(lowerPath)) {
    return {
      view: "admin",
      isNotFound: false,
    }
  }

  // Sub-routes for admin backoffice (e.g. /admin/orders, /admin/menu, /admin/dashboard, /admin/login, /admin/tenants/new)
  if (lowerPath.startsWith("admin/")) {
    const subRoute = lowerPath.slice("admin/".length)

    // Auth aliases (e.g. /admin/login, /admin/signin, /admin/auth)
    if (["login", "signin", "auth"].includes(subRoute)) {
      return {
        view: "admin",
        isNotFound: false,
      }
    }

    // Tenant/restaurant registry aliases (e.g. /admin/tenants, /admin/tenants/new, /admin/restaurants/new)
    if (["tenants", "tenants/new", "restaurants/new"].includes(subRoute)) {
      return {
        view: "admin",
        adminTab: "restaurants",
        isNotFound: false,
      }
    }

    if (VALID_ADMIN_TABS.includes(subRoute as AdminTab)) {
      return {
        view: "admin",
        adminTab: subRoute as AdminTab,
        isNotFound: false,
      }
    }

    // Any other /admin/* sub-route belongs to admin backoffice rather than 404 store
    return {
      view: "admin",
      adminTab: "dashboard",
      isNotFound: false,
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
      const slug = resolution.attemptedSlug
      if (slug && !slug.toLowerCase().startsWith('admin')) {
        apiClient
          .fetchRestaurant(slug)
          .then((restaurant) => {
            if (restaurant && restaurant.id) {
              switchRestaurant(restaurant.id)
              setIsNotFound(false)
              setAttemptedSlug(null)
              setActiveView("store")
            } else {
              setAttemptedSlug(slug)
              setIsNotFound(true)
              setActiveView("not-found")
            }
          })
          .catch(() => {
            setAttemptedSlug(slug)
            setIsNotFound(true)
            setActiveView("not-found")
          })
        return
      }
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
