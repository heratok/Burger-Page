import type { StoreBgTheme, CardStyle, CardRadius, FontFamily } from "@/types/restaurant"

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
