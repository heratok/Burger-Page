import { createContext, useContext } from "react"

/** Session-scoped admin grant flag (design: cleared when the tab closes). */
export const ADMIN_GRANT_KEY = "burger-page:admin-granted"

export interface AdminContextValue {
  granted: boolean
  login: () => void
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