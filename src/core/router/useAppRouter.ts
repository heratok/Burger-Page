import { useState, useEffect, useCallback } from "react"
import type { RestaurantRecord, AppView } from "@/types/restaurant"
import { useRestaurant } from "@/context/RestaurantContext"

export interface RouteResolution {
  view: AppView
  restaurantId?: string
  attemptedSlug?: string
  isNotFound: boolean
}

/**
 * Pure route resolution function mapping a URL pathname to the appropriate view & tenant.
 */
export function resolveRoute(
  pathname: string,
  restaurants: RestaurantRecord[]
): RouteResolution {
  const cleanPath = pathname.replace(/^\/+|\/+$/g, "")

  if (!cleanPath) {
    return {
      view: "store",
      isNotFound: false,
    }
  }

  if (cleanPath === "admin") {
    return {
      view: "admin",
      isNotFound: false,
    }
  }

  const matched = restaurants.find(
    (r) => r.slug.toLowerCase() === cleanPath.toLowerCase()
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
 * Custom router hook managing browser history, path syncing, and tenant switching.
 */
export function useAppRouter() {
  const { restaurants, switchRestaurant, setActiveView, activeView } = useRestaurant()
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
      setActiveView(resolution.view)
    }
  }, [restaurants, switchRestaurant, setActiveView])

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
    isNotFound,
    attemptedSlug,
    navigateTo,
  }
}
