import type React from "react"
import type { StoreBgTheme, CardStyle, CardRadius, FontFamily } from "@/types/restaurant"
import { getContrastForeground } from "@/lib/utils"

export interface FullThemeTemplate {
  id: string
  name: string
  tagline: string
  primaryColor: string
  primaryHoverColor: string
  bgTheme: StoreBgTheme
  cardStyle: CardStyle
  cardRadius: CardRadius
  fontFamily: FontFamily
  previewBg: string
}

export const FULL_THEME_TEMPLATES: FullThemeTemplate[] = [
  {
    id: "artisan-burger",
    name: "🍔 Hamburguesería Urbana",
    tagline: "Moderno, cálido y enfocado en apetito",
    primaryColor: "#FF7A21",
    primaryHoverColor: "#FF8F3F",
    bgTheme: "dark-charcoal",
    cardStyle: "elevated",
    cardRadius: "md",
    fontFamily: "sans",
    previewBg: "#0F1112",
  },
  {
    id: "gourmet-grill",
    name: "🥩 Parrilla & Bar Dark",
    tagline: "Elegante, contrastado y nocturno",
    primaryColor: "#F59E0B",
    primaryHoverColor: "#FBBF24",
    bgTheme: "deep-midnight",
    cardStyle: "glass",
    cardRadius: "lg",
    fontFamily: "display",
    previewBg: "#050607",
  },
  {
    id: "rustic-pizza",
    name: "🍕 Pizzería Tradicional",
    tagline: "Cálido estilo horno de leña y trattoria",
    primaryColor: "#E63946",
    primaryHoverColor: "#F25C69",
    bgTheme: "warm-cream",
    cardStyle: "elevated",
    cardRadius: "lg",
    fontFamily: "serif",
    previewBg: "#FAF6EF",
  },
  {
    id: "fresh-bistro",
    name: "🌮 Taquería & Bistro Fresh",
    tagline: "Limpio, luminoso y contemporáneo",
    primaryColor: "#10B981",
    primaryHoverColor: "#34D399",
    bgTheme: "clean-white",
    cardStyle: "bordered",
    cardRadius: "md",
    fontFamily: "sans",
    previewBg: "#FFFFFF",
  },
  {
    id: "premium-lounge",
    name: "🍸 Lounge de Autor",
    tagline: "Vanguardista con bordes redondeados",
    primaryColor: "#8B5CF6",
    primaryHoverColor: "#A78BFA",
    bgTheme: "dark-charcoal",
    cardStyle: "glass",
    cardRadius: "full",
    fontFamily: "sans",
    previewBg: "#0F1112",
  },
]

export function getFontFamilyClass(font?: FontFamily): string {
  switch (font) {
    case "serif":
      return "font-serif"
    case "mono":
      return "font-mono"
    case "display":
      return "font-sans tracking-tight font-extrabold"
    case "sans":
    default:
      return "font-sans"
  }
}

export function getRadiusClass(r: CardRadius): string {
  switch (r) {
    case "sm":
      return "rounded-lg"
    case "md":
      return "rounded-xl"
    case "lg":
      return "rounded-2xl"
    case "full":
      return "rounded-3xl"
    default:
      return "rounded-xl"
  }
}

export function getCardStyleClasses(style: CardStyle, bgTheme: StoreBgTheme): string {
  const isLightBg = bgTheme === "clean-white" || bgTheme === "warm-cream"
  switch (style) {
    case "elevated":
      return isLightBg
        ? "bg-white shadow-md border border-slate-100 text-slate-900"
        : "bg-[#1C2024] shadow-lg border border-slate-800 text-white"
    case "bordered":
      return isLightBg
        ? "bg-white border-2 border-slate-200 text-slate-900"
        : "bg-[#181A1B] border-2 border-slate-700 text-white"
    case "glass":
      return isLightBg
        ? "bg-white/70 backdrop-blur-md border border-white/60 shadow-sm text-slate-900"
        : "bg-slate-900/60 backdrop-blur-md border border-white/10 shadow-md text-white"
    case "minimal":
      return isLightBg
        ? "bg-slate-50/80 border-0 text-slate-900"
        : "bg-[#151719] border-0 text-white"
    default:
      return "bg-white shadow-sm border border-slate-100 text-slate-900"
  }
}

export function getBgStyle(theme: StoreBgTheme): { bg: string; text: string; subText: string } {
  switch (theme) {
    case "dark-charcoal":
      return { bg: "#0F1112", text: "#F5F5F7", subText: "#9BA1A6" }
    case "deep-midnight":
      return { bg: "#050607", text: "#FFFFFF", subText: "#8A9096" }
    case "warm-cream":
      return { bg: "#FAF6EF", text: "#2A231C", subText: "#6E6259" }
    case "clean-white":
      return { bg: "#FFFFFF", text: "#0F172A", subText: "#64748B" }
    default:
      return { bg: "#0F1112", text: "#F5F5F7", subText: "#9BA1A6" }
  }
}

export function getStoreThemeStyles(
  theme: StoreBgTheme,
  primaryColor: string = "#FF7A21"
): React.CSSProperties {
  const primaryForeground = getContrastForeground(primaryColor)
  switch (theme) {
    case "clean-white":
      return {
        "--color-bg-base": "#FFFFFF",
        "--color-bg-surface": "#F8FAFC",
        "--color-bg-elevated": "#FFFFFF",
        "--color-bg-elevated-2": "#F1F5F9",
        "--color-bg-input": "#F8FAFC",
        "--color-border-subtle": "#E2E8F0",
        "--color-border-strong": "#CBD5E1",
        "--color-text-primary": "#0F172A",
        "--color-text-secondary": "#475569",
        "--color-text-muted": "#64748B",
        "--color-background": "#FFFFFF",
        "--color-foreground": "#0F172A",
        "--color-card": "#FFFFFF",
        "--color-card-foreground": "#0F172A",
        "--color-popover": "#FFFFFF",
        "--color-popover-foreground": "#0F172A",
        "--color-muted": "#F1F5F9",
        "--color-muted-foreground": "#64748B",
        "--color-input": "#E2E8F0",
        "--color-border": "#E2E8F0",
        "--color-secondary": "#F1F5F9",
        "--color-secondary-foreground": "#0F172A",
        "--color-accent": primaryColor,
        "--color-accent-foreground": primaryForeground,
        "--color-primary": primaryColor,
        "--color-primary-foreground": primaryForeground,
        "--color-ring": primaryColor,
        backgroundColor: "#FFFFFF",
        color: "#0F172A",
      } as React.CSSProperties
    case "warm-cream":
      return {
        "--color-bg-base": "#FAF6EF",
        "--color-bg-surface": "#F4ECE1",
        "--color-bg-elevated": "#FFFFFF",
        "--color-bg-elevated-2": "#ECE2D0",
        "--color-bg-input": "#F7F0E6",
        "--color-border-subtle": "#E4DAC8",
        "--color-border-strong": "#D0C3AE",
        "--color-text-primary": "#2A231C",
        "--color-text-secondary": "#5C4F43",
        "--color-text-muted": "#8C7E72",
        "--color-background": "#FAF6EF",
        "--color-foreground": "#2A231C",
        "--color-card": "#FFFFFF",
        "--color-card-foreground": "#2A231C",
        "--color-popover": "#FFFFFF",
        "--color-popover-foreground": "#2A231C",
        "--color-muted": "#ECE2D0",
        "--color-muted-foreground": "#8C7E72",
        "--color-input": "#E4DAC8",
        "--color-border": "#E4DAC8",
        "--color-secondary": "#ECE2D0",
        "--color-secondary-foreground": "#2A231C",
        "--color-accent": primaryColor,
        "--color-accent-foreground": primaryForeground,
        "--color-primary": primaryColor,
        "--color-primary-foreground": primaryForeground,
        "--color-ring": primaryColor,
        backgroundColor: "#FAF6EF",
        color: "#2A231C",
      } as React.CSSProperties
    case "deep-midnight":
      return {
        "--color-bg-base": "#050607",
        "--color-bg-surface": "#101216",
        "--color-bg-elevated": "#181B22",
        "--color-bg-elevated-2": "#222630",
        "--color-bg-input": "#13161C",
        "--color-border-subtle": "#252B38",
        "--color-border-strong": "#374151",
        "--color-text-primary": "#FFFFFF",
        "--color-text-secondary": "#CBD5E1",
        "--color-text-muted": "#94A3B8",
        "--color-background": "#050607",
        "--color-foreground": "#FFFFFF",
        "--color-card": "#181B22",
        "--color-card-foreground": "#FFFFFF",
        "--color-popover": "#181B22",
        "--color-popover-foreground": "#FFFFFF",
        "--color-muted": "#222630",
        "--color-muted-foreground": "#94A3B8",
        "--color-input": "#252B38",
        "--color-border": "#252B38",
        "--color-secondary": "#222630",
        "--color-secondary-foreground": "#FFFFFF",
        "--color-accent": primaryColor,
        "--color-accent-foreground": primaryForeground,
        "--color-primary": primaryColor,
        "--color-primary-foreground": primaryForeground,
        "--color-ring": primaryColor,
        backgroundColor: "#050607",
        color: "#FFFFFF",
      } as React.CSSProperties
    case "dark-charcoal":
    default:
      return {
        "--color-bg-base": "#0F1112",
        "--color-bg-surface": "#181A1B",
        "--color-bg-elevated": "#212529",
        "--color-bg-elevated-2": "#2A2F35",
        "--color-bg-input": "#1A1D20",
        "--color-border-subtle": "#2D3138",
        "--color-border-strong": "#3A4048",
        "--color-text-primary": "#F5F5F7",
        "--color-text-secondary": "#C5C8CC",
        "--color-text-muted": "#8B8F95",
        "--color-background": "#0F1112",
        "--color-foreground": "#F5F5F7",
        "--color-card": "#212529",
        "--color-card-foreground": "#F5F5F7",
        "--color-popover": "#212529",
        "--color-popover-foreground": "#F5F5F7",
        "--color-muted": "#1A1D20",
        "--color-muted-foreground": "#8B8F95",
        "--color-input": "#1A1D20",
        "--color-border": "#2D3138",
        "--color-secondary": "#2A2F35",
        "--color-secondary-foreground": "#F5F5F7",
        "--color-accent": primaryColor,
        "--color-accent-foreground": primaryForeground,
        "--color-primary": primaryColor,
        "--color-primary-foreground": primaryForeground,
        "--color-ring": primaryColor,
        backgroundColor: "#0F1112",
        color: "#F5F5F7",
      } as React.CSSProperties
  }
}

