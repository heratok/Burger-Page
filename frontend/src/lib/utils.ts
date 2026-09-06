import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats numbers to currency string with thousand separators (e.g. $25.000 or USD 25.000),
 * handling edge cases (0, NaN, undefined, null) safely.
 */
export function formatCurrency(
  amount?: number | null,
  currencySymbol = "$"
): string {
  if (
    amount === undefined ||
    amount === null ||
    typeof amount !== "number" ||
    Number.isNaN(amount) ||
    !Number.isFinite(amount)
  ) {
    return `${currencySymbol}0`
  }
  return `${currencySymbol}${Math.round(amount).toLocaleString("es-CO")}`
}

/**
 * Extracts only digits from a phone string.
 */
export function cleanPhoneNumber(phone?: string | null): string {
  if (!phone) return ""
  return phone.replace(/\D/g, "")
}

/**
 * Cleans phone and ensures it has the country code prefix.
 */
export function formatWhatsAppPhone(
  phone?: string | null,
  defaultCountryCode = "57"
): string {
  const cleaned = cleanPhoneNumber(phone)
  if (!cleaned) return ""
  if (cleaned.startsWith(defaultCountryCode)) {
    return cleaned
  }
  return `${defaultCountryCode}${cleaned}`
}

/**
 * Computes a WCAG-compliant contrasting foreground color (#0F172A or #FFFFFF)
 * based on the relative luminance of any custom background hex color,
 * choosing the option that yields the higher contrast ratio.
 */
export function getContrastForeground(hexColor?: string | null): string {
  if (!hexColor) return "#FFFFFF"
  const clean = hexColor.replace("#", "").trim()
  if (clean.length !== 6 && clean.length !== 3) return "#FFFFFF"
  const full = clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean
  const r = parseInt(full.substring(0, 2), 16)
  const g = parseInt(full.substring(2, 4), 16)
  const b = parseInt(full.substring(4, 6), 16)
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return "#FFFFFF"
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  const lum = 0.2126 * rs + 0.7152 * gs + 0.0722 * bs

  // Contrast against White (Luminance = 1.0)
  const contrastWithWhite = (1.0 + 0.05) / (lum + 0.05)
  // Contrast against Dark Slate #0F172A (Luminance ≈ 0.013)
  const contrastWithDark = (lum + 0.05) / (0.013 + 0.05)

  return contrastWithDark > contrastWithWhite ? "#0F172A" : "#FFFFFF"
}
