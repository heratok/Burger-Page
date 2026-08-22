import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import type { AdminTab, AdminTheme, AppView } from "@/types/restaurant"

export interface UiContextType {
  activeView: AppView
  setActiveView: (view: AppView) => void
  adminTab: AdminTab
  setAdminTab: (tab: AdminTab) => void
  adminTheme: AdminTheme
  setAdminTheme: (theme: AdminTheme) => void
  toggleAdminTheme: () => void
  soundEnabled: boolean
  setSoundEnabled: (enabled: boolean) => void
}

const STORAGE_KEYS = {
  ADMIN_THEME: "burger_page_admin_theme_v2",
  SOUND: "burger_page_sound_enabled_v2",
}

const UiContext = createContext<UiContextType | undefined>(undefined)

export const UiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeView, setActiveView] = useState<AppView>(() => {
    try {
      if (typeof window !== "undefined") {
        const clean = window.location.pathname.replace(/^\/+|\/+$/g, "").toLowerCase()
        if (!clean) return "landing"
        if (clean === "admin") return "admin"
        return "store"
      }
    } catch {
      // Fallback for SSR/tests
    }
    return "landing"
  })
  const [adminTab, setAdminTab] = useState<AdminTab>("dashboard")
  const [adminTheme, setAdminTheme] = useState<AdminTheme>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ADMIN_THEME)
      return saved === "dark" || saved === "light" ? saved : "dark"
    } catch {
      return "dark"
    }
  })
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SOUND)
      return saved !== null ? JSON.parse(saved) : true
    } catch {
      return true
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ADMIN_THEME, adminTheme)
  }, [adminTheme])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SOUND, JSON.stringify(soundEnabled))
  }, [soundEnabled])

  const toggleAdminTheme = useCallback(() => {
    setAdminTheme((prev) => (prev === "dark" ? "light" : "dark"))
  }, [])

  const value: UiContextType = {
    activeView,
    setActiveView,
    adminTab,
    setAdminTab,
    adminTheme,
    setAdminTheme,
    toggleAdminTheme,
    soundEnabled,
    setSoundEnabled,
  }

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>
}

export const useUi = (): UiContextType => {
  const context = useContext(UiContext)
  if (!context) {
    throw new Error("useUi must be used within a UiProvider")
  }
  return context
}
