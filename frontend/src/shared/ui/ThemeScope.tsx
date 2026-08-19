import { useEffect } from "react"
import type { ReactNode } from "react"
import { applyTheme } from "@/shared/domain/theme"
import { DEFAULT_PALETTE } from "@/data/data"
import type { RestaurantPalette } from "@/shared/domain/domain"

interface ThemeScopeProps {
  palette: RestaurantPalette
  children: ReactNode
}

/**
 * Declarative theme application (design D3, spec TH-1/TH-2). Mounting a
 * ThemeScope applies `palette` to :root; every subsequent mount applies its
 * own palette, so leaving a restaurant (mounting the directory or the default
 * scope) restores the default theme without imperative cleanup.
 */
export function ThemeScope({ palette, children }: ThemeScopeProps) {
  useEffect(() => {
    applyTheme(palette)
  }, [palette])

  return <>{children}</>
}

/** Applies the default palette: directory, super portal and shared shells. */
export function DefaultThemeScope({ children }: { children: ReactNode }) {
  return <ThemeScope palette={DEFAULT_PALETTE}>{children}</ThemeScope>
}