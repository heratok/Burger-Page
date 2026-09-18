import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import type { AdminSession } from "@/types/restaurant"
import { toast } from "sonner"
import { apiClient } from "@/core/api/apiClient"

export interface AuthContextType {
  session: AdminSession
  /**
   * Authenticates against the backend. There is intentionally NO local
   * password fallback: default or leaked credentials must never grant
   * admin access, and the apiClient only ever carries real server tokens.
   */
  login: (
    username: string,
    password: string,
    targetRestaurantIdOrSlug?: string
  ) => Promise<{
    success: boolean
    role: "super" | "restaurant" | null
    restaurantId?: string
    error?: string
  }>
  logout: () => void
  setSession: React.Dispatch<React.SetStateAction<AdminSession>>
}

const STORAGE_KEYS = {
  SESSION: "burger_page_session_v2",
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AdminSession>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEYS.SESSION)
      if (saved) {
        return JSON.parse(saved) as AdminSession
      }
      return { role: "guest" }
    } catch {
      return { role: "guest" }
    }
  })

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session))
  }, [session])

  const login = useCallback(
    async (
      username: string,
      password: string,
      targetRestaurantIdOrSlug?: string
    ): Promise<{
      success: boolean
      role: "super" | "restaurant" | null
      restaurantId?: string
      error?: string
    }> => {
      const trimmedUser = username.trim()
      const trimmedPass = password.trim()
      if (!trimmedUser || !trimmedPass) {
        return { success: false, role: null, error: "Usuario y contraseña son requeridos" }
      }

      try {
        const result = await apiClient.login(trimmedUser, trimmedPass)
        if (!result.success || !result.user) {
          return {
            success: false,
            role: null,
            error: result.error || "Credenciales incorrectas",
          }
        }

        const isSuper = result.user.role === "super_admin"
        const role = isSuper ? ("super" as const) : ("restaurant" as const)
        setSession({
          role,
          restaurantId: result.user.restaurantId,
          authenticatedAt: new Date().toISOString(),
        })

        if (role === "super") {
          toast.success(`Bienvenido, ${result.user.username}`)
        } else if (result.user.restaurantId) {
          toast.success("Bienvenido al panel de administración")
        }

        return {
          success: true,
          role,
          restaurantId: result.user.restaurantId ?? targetRestaurantIdOrSlug,
        }
      } catch (err: any) {
        console.error("[AUTH] Backend login failed:", err)
        return {
          success: false,
          role: null,
          error:
            err?.message?.includes("fetch") || err?.name === "TypeError"
              ? "No se pudo conectar con el servidor"
              : "Credenciales incorrectas",
        }
      }
    },
    []
  )

  const logout = useCallback(() => {
    setSession({ role: "guest" })
    apiClient.setToken(null)
    toast.info("Sesión cerrada")
  }, [])

  const value: AuthContextType = {
    session,
    login,
    logout,
    setSession,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

const DEFAULT_GUEST_SESSION: AdminSession = Object.freeze({ role: "guest" })

const DEFAULT_AUTH_CONTEXT: AuthContextType = Object.freeze({
  session: DEFAULT_GUEST_SESSION,
  login: async () => ({ success: false, role: null }),
  logout: () => {},
  setSession: () => {},
})

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  return context || DEFAULT_AUTH_CONTEXT
}
