import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import { storage } from "@/shared/storage/storage"
import {
  SUPER_ADMIN_GRANT_KEY,
  AdminContext,
  adminGrantKey,
  clearStoredSession,
  readStoredSession,
} from "./admin-context"
import type { AdminContextValue, AdminMode, AdminSession } from "./admin-context"

/**
 * Session-scoped, mode-aware admin access (design D4, spec AD-1): grants live
 * in sessionStorage keyed by mode/restaurant, survive reloads and die with the
 * tab. Exactly one session is active at a time; logging in replaces it, and
 * switching restaurant scope invalidates the previous restaurant session.
 */
export function AdminProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(() =>
    readStoredSession(sessionStorage, storage.listRestaurants()[0]?.id)
  )

  const value = useMemo<AdminContextValue>(() => {
    const login = (mode: AdminMode, restaurantId?: string) => {
      clearStoredSession(sessionStorage)
      if (mode === "super") {
        sessionStorage.setItem(SUPER_ADMIN_GRANT_KEY, "1")
        setSession({ mode: "super" })
        return
      }
      if (restaurantId === undefined) return
      sessionStorage.setItem(adminGrantKey(restaurantId), "1")
      setSession({ mode: "restaurant", restaurantId })
    }

    const logout = () => {
      clearStoredSession(sessionStorage)
      setSession(null)
    }

    return { session, login, logout }
  }, [session])

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
}