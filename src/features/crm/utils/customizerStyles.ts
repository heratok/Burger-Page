import type { StoreBgTheme, CardStyle, CardRadius } from "@/types/restaurant"

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
