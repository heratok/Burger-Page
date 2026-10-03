import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react"
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
    mustChangePassword?: boolean
    error?: string
  }>
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  setSession: React.Dispatch<React.SetStateAction<AdminSession>>
}

function parseJwtPayload(token?: string): { userId?: string; username?: string; role?: string } | null {
  if (!token) return null
  try {
    const parts = token.split(".")
    if (parts.length < 2) return null
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

const STORAGE_KEYS = {
  SESSION: "burger_page_session_v2",
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{
  children: React.ReactNode
  /**
   * Session-end callback invoked by logout() AFTER the session and token are
   * cleared. AuthContext does not own the tenant repository, so the purge of
   * the whole-tenant localStorage envelope (C3) is wired here by the provider
   * composition (RestaurantProvider), keeping this slice storage-agnostic.
   */
  onLogout?: () => void
}> = ({ children, onLogout }) => {
  const [session, setSession] = useState<AdminSession>(() => {
    try {
      const saved =
        sessionStorage.getItem(STORAGE_KEYS.SESSION) ||
        localStorage.getItem(STORAGE_KEYS.SESSION) ||
        localStorage.getItem("admin_session")
      if (saved) {
        const parsed = JSON.parse(saved) as AdminSession & { token?: string }
        const token =
          parsed.token ||
          (typeof sessionStorage !== "undefined"
            ? sessionStorage.getItem("burger_page_auth_token_v2")
            : null)
        if (token && (!parsed.userId || !parsed.username)) {
          const payload = parseJwtPayload(token)
          if (payload?.userId && !parsed.userId) parsed.userId = payload.userId
          if (payload?.username && !parsed.username) parsed.username = payload.username
        }
        return parsed
      }
      return { role: "guest" }
    } catch {
      return { role: "guest" }
    }
  })

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session))
  }, [session])

  useEffect(() => {
    return apiClient.onPasswordChangeRequired(() => {
      setSession((prev) => {
        if (prev.role === "guest") return prev
        return { ...prev, mustChangePassword: true }
      })
    })
  }, [])

  const sessionRoleRef = useRef(session.role)
  sessionRoleRef.current = session.role

  const sessionExpiredHandledRef = useRef(false)
  useEffect(() => {
    if (session.role !== "guest") {
      sessionExpiredHandledRef.current = false
    }
  }, [session.role])

  useEffect(() => {
    return apiClient.onSessionExpired(() => {
      if (sessionRoleRef.current === "guest") return
      if (sessionExpiredHandledRef.current) return
      sessionExpiredHandledRef.current = true

      setSession({ role: "guest" })
      apiClient.setToken(null)
      onLogout?.()
      toast.error("Tu sesión expiró. Iniciá sesión de nuevo.")

      if (typeof window !== "undefined") {
        if (
          window.location.pathname.startsWith("/admin") ||
          window.location.pathname === "/login"
        ) {
          window.history.pushState({}, "", "/admin")
          window.dispatchEvent(new PopStateEvent("popstate"))
        }
      }
    })
  }, [onLogout])

  const login = useCallback(
    async (
      username: string,
      password: string,
      targetRestaurantIdOrSlug?: string
    ): Promise<{
      success: boolean
      role: "super" | "restaurant" | null
      restaurantId?: string
      mustChangePassword?: boolean
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
        const mustChangePassword = Boolean(result.user.mustChangePassword)
        setSession({
          role,
          userId: result.user.id,
          username: result.user.username,
          restaurantId: result.user.restaurantId,
          mustChangePassword,
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
          mustChangePassword,
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

  const changePassword = useCallback(
    async (
      currentPassword: string,
      newPassword: string
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await apiClient.changeOwnPassword(currentPassword, newPassword)
        if (res.success) {
          setSession((prev) => ({ ...prev, mustChangePassword: false }))
          toast.success("Contraseña actualizada exitosamente")
          return { success: true }
        }
        return { success: false, error: "No se pudo actualizar la contraseña" }
      } catch (err: any) {
        const rawMsg = err?.message || ""
        let errorMsg = "Error al actualizar la contraseña"
        const isWrongCurrent =
          err?.status === 400 ||
          rawMsg.toLowerCase().includes("current password") ||
          err?.code === "INVALID_CURRENT_PASSWORD"
        if (isWrongCurrent) {
          errorMsg = "La contraseña actual es incorrecta"
          // Defect 4: show error inline once without toast
        } else {
          toast.error(rawMsg || errorMsg)
        }
        return { success: false, error: errorMsg }
      }
    },
    []
  )

  const logout = useCallback(() => {
    setSession({ role: "guest" })
    apiClient.setToken(null)
    // C3: purge whole-tenants envelope + persisted active restaurant exactly
    // once, at session end. Guest storefront caching is unaffected (this path
    // only runs when an authenticated session is being closed).
    onLogout?.()
    toast.info("Sesión cerrada")
  }, [onLogout])

  const value: AuthContextType = useMemo(
    () => ({
      session,
      login,
      changePassword,
      logout,
      setSession,
    }),
    [session, login, changePassword, logout, setSession]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

const DEFAULT_GUEST_SESSION: AdminSession = Object.freeze({ role: "guest" })

const DEFAULT_AUTH_CONTEXT: AuthContextType = Object.freeze({
  session: DEFAULT_GUEST_SESSION,
  login: async () => ({ success: false, role: null }),
  changePassword: async () => ({ success: false }),
  logout: () => {},
  setSession: () => {},
})

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  return context || DEFAULT_AUTH_CONTEXT
}
