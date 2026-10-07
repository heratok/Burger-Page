import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import type { RestaurantRecord, AppView, AdminTab, UserRole } from "@/types/restaurant"
import type { Permission } from "@burger-page/contracts"
import { useUi, useTenant } from "@/context/RestaurantContext"
import { useAuth } from "@/context/slices/AuthContext"
import { ADMIN_ROOT_PATHS } from "./adminRootPaths"

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
  "audit",
  "equipo",
  "roles",
]

export const TAB_PERMISSION_REQUIREMENTS: Partial<Record<AdminTab, Permission | Permission[]>> = {
  dashboard: "finance.view",
  reports: "finance.view",
  orders: ["orders.view", "orders.manage"],
  customers: ["customers.view", "customers.manage"],
  menu: "menu.manage",
  inventory: "inventory.manage",
  tables: "tables.manage",
  customizer: "settings.manage",
  settings: "settings.manage",
  equipo: "users.manage",
  roles: "roles.manage",
}

const SUPER_ONLY_ADMIN_TABS = new Set<AdminTab>(["restaurants", "users", "metrics", "audit"])

export const RESTAURANT_TAB_ORDER: AdminTab[] = [
  "dashboard",
  "orders",
  "tables",
  "menu",
  "inventory",
  "customers",
  "reports",
  "equipo",
  "roles",
  "customizer",
  "settings",
]

export function isTabAllowed(
  tab: AdminTab,
  can?: (permission: Permission) => boolean,
  role?: UserRole
): boolean {
  if (role === "super") return true
  if (SUPER_ONLY_ADMIN_TABS.has(tab)) return false
  if (role === "restaurant") return true
  if (!can) return true
  const req = TAB_PERMISSION_REQUIREMENTS[tab]
  if (!req) return true
  if (Array.isArray(req)) {
    return req.some((p) => can(p))
  }
  return can(req)
}

export function getFirstAllowedTab(
  can?: (permission: Permission) => boolean,
  role?: UserRole
): AdminTab {
  if (role === "super") return "restaurants"
  if (role === "restaurant") return "dashboard"
  for (const tab of RESTAURANT_TAB_ORDER) {
    if (isTabAllowed(tab, can, role)) return tab
  }
  return "orders"
}

export interface RouteOptions {
  can?: (permission: Permission) => boolean
  role?: UserRole
}

/**
 * Pure route resolution function mapping a URL pathname to the appropriate view, sub-tab & tenant.
 */
export function resolveRoute(
  pathname: string,
  restaurants: RestaurantRecord[],
  options?: RouteOptions
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
  if (ADMIN_ROOT_PATHS.includes(lowerPath)) {
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

    if (["audit-log", "auditlog"].includes(subRoute)) {
      return {
        view: "admin",
        adminTab: "audit",
        isNotFound: false,
      }
    }

    if (subRoute === "team") {
      let resolvedTab: AdminTab = "equipo"
      if (options?.can && !isTabAllowed(resolvedTab, options.can, options.role)) {
        resolvedTab = getFirstAllowedTab(options.can, options.role)
      }
      return {
        view: "admin",
        adminTab: resolvedTab,
        isNotFound: false,
      }
    }

    if (VALID_ADMIN_TABS.includes(subRoute as AdminTab)) {
      let resolvedTab = subRoute as AdminTab
      if (options?.can && !isTabAllowed(resolvedTab, options.can, options.role)) {
        resolvedTab = getFirstAllowedTab(options.can, options.role)
      }
      return {
        view: "admin",
        adminTab: resolvedTab,
        isNotFound: false,
      }
    }

    // Any other /admin/* sub-route belongs to admin backoffice rather than 404 store
    const defaultTab = options?.can ? getFirstAllowedTab(options.can, options.role) : "dashboard"
    return {
      view: "admin",
      adminTab: defaultTab,
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
  const { setActiveView, activeView, adminTab, setAdminTab } = useUi()
  const { restaurants, switchRestaurant, loadRestaurant } = useTenant()
  const { can, session } = useAuth()
  const [attemptedSlug, setAttemptedSlug] = useState<string | null>(null)
  const [isNotFound, setIsNotFound] = useState(false)
  const [loadError, setLoadError] = useState(false)
  // A 404 is an authoritative answer: provider/state churn that re-runs the
  // effect must not re-request a slug already known to be missing. Explicit
  // user actions (retry, navigation, popstate) pass `force` to look again.
  const notFoundSlugRef = useRef<string | null>(null)
  const inFlightSlugRef = useRef<string | null>(null)

  const routeOptions = useMemo<RouteOptions>(
    () => ({ can, role: session.role }),
    [can, session.role]
  )

  const syncLocation = useCallback((force = false) => {
    const resolution = resolveRoute(window.location.pathname, restaurants, routeOptions)

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
  }, [restaurants, switchRestaurant, loadRestaurant, setActiveView, setAdminTab, routeOptions])


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

  // A storefront URL whose slug is not known yet has no tenant to show: until
  // the backend answers, rendering the store would paint a placeholder (or a
  // previous tenant) that may turn out to be a 404. Derived from the CURRENT
  // URL on every render, so it never lags behind the sync effect.
  const isResolving =
    activeView === "store" &&
    !isNotFound &&
    resolveRoute(window.location.pathname, restaurants).isNotFound

  return {
    activeView,
    adminTab,
    isNotFound,
    isResolving,
    attemptedSlug,
    loadError,
    retry: () => syncLocation(true),
    navigateTo,
  }
}
