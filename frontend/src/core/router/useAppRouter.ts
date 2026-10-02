import { useState, useEffect, useCallback, useRef } from "react"
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
  "tables",
  "menu",
  "inventory",
  "customers",
  "reports",
  "customizer",
  "settings",
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
    loadRestaurant,
    setActiveView,
    activeView,
    adminTab,
    setAdminTab,
  } = useRestaurant()
  const [attemptedSlug, setAttemptedSlug] = useState<string | null>(null)
  const [isNotFound, setIsNotFound] = useState(false)
  const [loadError, setLoadError] = useState(false)
  // A 404 is an authoritative answer: provider/state churn that re-runs the
  // effect must not re-request a slug already known to be missing. Explicit
  // user actions (retry, navigation, popstate) pass `force` to look again.
  const notFoundSlugRef = useRef<string | null>(null)
  const inFlightSlugRef = useRef<string | null>(null)

  const syncLocation = useCallback((force = false) => {
    const resolution = resolveRoute(window.location.pathname, restaurants)

    if (resolution.isNotFound) {
      const slug = resolution.attemptedSlug
      if (slug && !slug.toLowerCase().startsWith('admin')) {
        if (!force && inFlightSlugRef.current === slug) return
        if (!force && notFoundSlugRef.current === slug) {
          setAttemptedSlug(slug)
          setLoadError(false)
          setIsNotFound(true)
          setActiveView("not-found")
          return
        }
        inFlightSlugRef.current = slug
        // Single fetch: loadRestaurant registers AND activates the record, so
        // there is no second fetch that could fail and leave another tenant's
        // storefront on screen.
        loadRestaurant(slug).then((outcome) => {
          inFlightSlugRef.current = null
          notFoundSlugRef.current = outcome === "not-found" ? slug : null
          if (outcome === "ok") {
            setIsNotFound(false)
            setLoadError(false)
            setAttemptedSlug(null)
            setActiveView("store")
          } else {
            setAttemptedSlug(slug)
            setIsNotFound(true)
            setLoadError(outcome === "error")
            setActiveView("not-found")
          }
        })
        return
      }
      setAttemptedSlug(resolution.attemptedSlug ?? null)
      setLoadError(false)
      setIsNotFound(true)
      setActiveView("not-found")
    } else {
      notFoundSlugRef.current = null
      setIsNotFound(false)
      setLoadError(false)
      setAttemptedSlug(null)
      if (resolution.restaurantId) {
        switchRestaurant(resolution.restaurantId)
      }
      if (resolution.adminTab) {
        setAdminTab(resolution.adminTab)
      }
      setActiveView(resolution.view)
    }
  }, [restaurants, switchRestaurant, loadRestaurant, setActiveView, setAdminTab])

  useEffect(() => {
    syncLocation()
    const onPopState = () => syncLocation(true)
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [syncLocation])

  const navigateTo = useCallback(
    (path: string) => {
      window.history.pushState({}, "", path)
      syncLocation(true)
    },
    [syncLocation]
  )

  return {
    activeView,
    adminTab,
    isNotFound,
    attemptedSlug,
    loadError,
    retry: () => syncLocation(true),
    navigateTo,
  }
}
