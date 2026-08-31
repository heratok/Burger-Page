import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import type { AdminSession, RestaurantRecord } from "@/types/restaurant"
import { toast } from "sonner"
import { apiClient } from "@/core/api/apiClient"

export interface AuthContextType {
  session: AdminSession
  login: (
    password: string,
    restaurants: RestaurantRecord[],
    superAdminPassword?: string,
    activeRestaurant?: RestaurantRecord,
    targetRestaurantIdOrSlug?: string
  ) => {
    success: boolean
    role: "super" | "restaurant" | null
    restaurantId?: string
    error?: string
  }
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
    (
      password: string,
      restaurants: RestaurantRecord[],
      superAdminPassword = "admin",
      activeRestaurant?: RestaurantRecord,
      targetRestaurantIdOrSlug?: string
    ) => {
      const trimmed = password.trim()

      // 1. Check Super Admin Password
      if (
        superAdminPassword &&
        trimmed === superAdminPassword
      ) {
        const newSession: AdminSession = {
          role: "super",
          authenticatedAt: new Date().toISOString(),
        }
        setSession(newSession)
        toast.success("Acceso concedido como Super Administrador")
        return { success: true, role: "super" as const }
      }

      // 2. Check Local Restaurant Admin Passwords
      const candidateRest = targetRestaurantIdOrSlug
        ? restaurants.find(
            (r) =>
              r.id === targetRestaurantIdOrSlug ||
              r.slug === targetRestaurantIdOrSlug
          )
        : activeRestaurant

      if (
        candidateRest &&
        candidateRest.adminPassword &&
        candidateRest.adminPassword === trimmed
      ) {
        const newSession: AdminSession = {
          role: "restaurant",
          restaurantId: candidateRest.id,
          authenticatedAt: new Date().toISOString(),
        }
        setSession(newSession)
        toast.success(`Bienvenido al panel de ${candidateRest.config.name}`)
        return {
          success: true,
          role: "restaurant" as const,
          restaurantId: candidateRest.id,
        }
      }

      // 3. Fallback: check all restaurants for matching password
      const matched = restaurants.find(
        (r) => r.adminPassword && r.adminPassword === trimmed
      )
      if (matched) {
        const newSession: AdminSession = {
          role: "restaurant",
          restaurantId: matched.id,
          authenticatedAt: new Date().toISOString(),
        }
        setSession(newSession)
        toast.success(`Bienvenido al panel de ${matched.config.name}`)
        return {
          success: true,
          role: "restaurant" as const,
          restaurantId: matched.id,
        }
      }

      toast.error("Contraseña incorrecta")
      return { success: false, role: null, error: "Contraseña incorrecta" }
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

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
