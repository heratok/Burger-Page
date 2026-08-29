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
