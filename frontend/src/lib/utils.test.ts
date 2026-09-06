import { describe, it, expect } from "vitest"
import {
  cn,
  formatCurrency,
  cleanPhoneNumber,
  formatWhatsAppPhone,
  getContrastForeground,
} from "./utils"

describe("lib/utils utilities", () => {
  describe("cn", () => {
    it("merges classes and handles tailwind conflicts", () => {
      expect(cn("px-2 py-1", "bg-red-500", "px-4")).toBe("py-1 bg-red-500 px-4")
      expect(cn("text-red-500", false && "hidden", null, undefined, "text-blue-500")).toBe(
        "text-blue-500"
      )
    })
  })

  describe("formatCurrency", () => {
    it("formats standard amounts with thousand separators in COP default style", () => {
      expect(formatCurrency(25000)).toMatch(/^\$25[.,]000$/)
      expect(formatCurrency(1500000)).toMatch(/^\$1[.,]500[.,]000$/)
      expect(formatCurrency(500)).toMatch(/^\$500$/)
    })

    it("supports custom currency symbols", () => {
      expect(formatCurrency(25000, "USD ")).toMatch(/^USD 25[.,]000$/)
      expect(formatCurrency(100, "€")).toMatch(/^€100$/)
      expect(formatCurrency(1234, "")).toMatch(/^1[.,]234$/)
    })

    it("handles 0 correctly", () => {
      expect(formatCurrency(0)).toBe("$0")
      expect(formatCurrency(0, "USD ")).toBe("USD 0")
    })

    it("safely handles null, undefined, NaN, and non-finite values", () => {
      expect(formatCurrency(undefined)).toBe("$0")
      expect(formatCurrency(null)).toBe("$0")
      expect(formatCurrency(NaN)).toBe("$0")
      expect(formatCurrency(Infinity)).toBe("$0")
      expect(formatCurrency(-Infinity)).toBe("$0")
      expect(formatCurrency("invalid" as unknown as number)).toBe("$0")
    })

    it("rounds decimal amounts to nearest whole currency unit", () => {
      expect(formatCurrency(25000.4)).toMatch(/^\$25[.,]000$/)
      expect(formatCurrency(25000.8)).toMatch(/^\$25[.,]001$/)
    })
  })

  describe("cleanPhoneNumber", () => {
    it("extracts only digits from phone string", () => {
      expect(cleanPhoneNumber("+57 (302) 257-5805")).toBe("573022575805")
      expect(cleanPhoneNumber("300-123-4567")).toBe("3001234567")
      expect(cleanPhoneNumber(" 300 123 4567 ")).toBe("3001234567")
    })

    it("handles empty, null, or undefined values safely", () => {
      expect(cleanPhoneNumber("")).toBe("")
      expect(cleanPhoneNumber(null)).toBe("")
      expect(cleanPhoneNumber(undefined)).toBe("")
    })

    it("returns empty string if string has no digits", () => {
      expect(cleanPhoneNumber("abc-def")).toBe("")
    })
  })

  describe("formatWhatsAppPhone", () => {
    it("prepends default country code (57) if missing", () => {
      expect(formatWhatsAppPhone("3022575805")).toBe("573022575805")
      expect(formatWhatsAppPhone("300 123 4567")).toBe("573001234567")
      expect(formatWhatsAppPhone("(300) 123-4567")).toBe("573001234567")
    })

    it("keeps country code if already present", () => {
      expect(formatWhatsAppPhone("573022575805")).toBe("573022575805")
      expect(formatWhatsAppPhone("+573022575805")).toBe("573022575805")
      expect(formatWhatsAppPhone("+57 (302) 257-5805")).toBe("573022575805")
    })

    it("supports custom country code", () => {
      expect(formatWhatsAppPhone("2025550123", "1")).toBe("12025550123")
      expect(formatWhatsAppPhone("12025550123", "1")).toBe("12025550123")
      expect(formatWhatsAppPhone("+1 (202) 555-0123", "1")).toBe("12025550123")
    })

    it("safely handles empty, null, or undefined values", () => {
      expect(formatWhatsAppPhone("")).toBe("")
      expect(formatWhatsAppPhone(null)).toBe("")
      expect(formatWhatsAppPhone(undefined)).toBe("")
    })
  })

  describe("getContrastForeground", () => {
    it("returns dark text for light or high-luminance colors (yellow, lime, cyan, white)", () => {
      expect(getContrastForeground("#FACC15")).toBe("#0F172A") // Bright yellow
      expect(getContrastForeground("#A3E635")).toBe("#0F172A") // Bright lime
      expect(getContrastForeground("#FFFFFF")).toBe("#0F172A") // Pure white
      expect(getContrastForeground("#38BDF8")).toBe("#0F172A") // Light cyan
      expect(getContrastForeground("#FFF")).toBe("#0F172A")    // 3-digit shorthand
    })

    it("returns white text for dark or low-luminance colors (red, purple, black, navy)", () => {
      expect(getContrastForeground("#E63946")).toBe("#FFFFFF") // Red gourmet
      expect(getContrastForeground("#8B5CF6")).toBe("#FFFFFF") // Purple premium
      expect(getContrastForeground("#000000")).toBe("#FFFFFF") // Pure black
      expect(getContrastForeground("#1E293B")).toBe("#FFFFFF") // Dark navy
      expect(getContrastForeground("#000")).toBe("#FFFFFF")    // 3-digit shorthand
    })

    it("handles null, undefined, and malformed inputs gracefully", () => {
      expect(getContrastForeground(null)).toBe("#FFFFFF")
      expect(getContrastForeground(undefined)).toBe("#FFFFFF")
      expect(getContrastForeground("")).toBe("#FFFFFF")
      expect(getContrastForeground("not-a-color")).toBe("#FFFFFF")
    })
  })
})
