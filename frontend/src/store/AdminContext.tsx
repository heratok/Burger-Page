import { useState } from "react"
import type { ReactNode } from "react"
import { ADMIN_GRANT_KEY, AdminContext } from "./admin-context"

/**
 * Session-scoped admin access (design decision): the grant lives in
 * sessionStorage, so it survives reloads but dies with the tab. No user
 * system — the gate compares against config.adminPassword.
 */
export function AdminProvider({ children }: { children: ReactNode }) {
  const [granted, setGranted] = useState(
    () => sessionStorage.getItem(ADMIN_GRANT_KEY) === "1"
  )

  const value = {
    granted,
    login: () => {
      sessionStorage.setItem(ADMIN_GRANT_KEY, "1")
      setGranted(true)
    },
    logout: () => {
      sessionStorage.removeItem(ADMIN_GRANT_KEY)
      setGranted(false)
    },
  }

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
}