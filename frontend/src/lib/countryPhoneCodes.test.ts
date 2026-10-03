import { describe, it, expect } from "vitest"
import {
  POPULAR_COUNTRY_CODES,
  splitPhoneNumber,
  combinePhoneNumber,
} from "./countryPhoneCodes"

describe("countryPhoneCodes", () => {
  describe("POPULAR_COUNTRY_CODES", () => {
    it("exports popular Latin American, US, and European country codes", () => {
      expect(POPULAR_COUNTRY_CODES.length).toBe(20)

      const colombia = POPULAR_COUNTRY_CODES.find((c) => c.code === "CO")
      expect(colombia).toEqual({
        code: "CO",
        name: "Colombia",
        dialCode: "57",
        flag: "🇨🇴",
      })

      const dominicana = POPULAR_COUNTRY_CODES.find((c) => c.code === "DO")
      expect(dominicana).toEqual({
        code: "DO",
        name: "Rep. Dominicana",
        dialCode: "1809",
        flag: "🇩🇴",
      })

      const us = POPULAR_COUNTRY_CODES.find((c) => c.code === "US")
      expect(us).toEqual({
        code: "US",
        name: "Estados Unidos",
        dialCode: "1",
        flag: "🇺🇸",
      })
    })
  })

  describe("splitPhoneNumber", () => {
    it("returns default dialCode and empty string for null, undefined, or empty values", () => {
      expect(splitPhoneNumber(null)).toEqual({ dialCode: "57", nationalNumber: "" })
      expect(splitPhoneNumber(undefined)).toEqual({ dialCode: "57", nationalNumber: "" })
      expect(splitPhoneNumber("")).toEqual({ dialCode: "57", nationalNumber: "" })
      expect(splitPhoneNumber("   ")).toEqual({ dialCode: "57", nationalNumber: "" })
      expect(splitPhoneNumber(null, "52")).toEqual({ dialCode: "52", nationalNumber: "" })
    })

    it("correctly splits Colombian phone numbers", () => {
      expect(splitPhoneNumber("573022575805")).toEqual({
        dialCode: "57",
        nationalNumber: "3022575805",
      })
      expect(splitPhoneNumber("+57 302 257 5805")).toEqual({
        dialCode: "57",
        nationalNumber: "3022575805",
      })
    })

    it("correctly splits Mexican and Spanish phone numbers", () => {
      expect(splitPhoneNumber("+52 (55) 1234-5678")).toEqual({
        dialCode: "52",
        nationalNumber: "5512345678",
      })
      expect(splitPhoneNumber("34612345678")).toEqual({
        dialCode: "34",
        nationalNumber: "612345678",
      })
    })

    it("correctly prioritizes longer dial codes like Dominican Republic 1809 over US 1", () => {
      expect(splitPhoneNumber("18091234567")).toEqual({
        dialCode: "1809",
        nationalNumber: "1234567",
      })
      expect(splitPhoneNumber("+1 415 555 2671")).toEqual({
        dialCode: "1",
        nationalNumber: "4155552671",
      })
    })

    it("correctly splits 3-digit dial codes like Ecuador 593 and Uruguay 598", () => {
      expect(splitPhoneNumber("+593 99 123 4567")).toEqual({
        dialCode: "593",
        nationalNumber: "991234567",
      })
      expect(splitPhoneNumber("59891234567")).toEqual({
        dialCode: "598",
        nationalNumber: "91234567",
      })
    })

    it("falls back to default dialCode when raw number does not match any popular dial code", () => {
      expect(splitPhoneNumber("9876543210")).toEqual({
        dialCode: "57",
        nationalNumber: "9876543210",
      })
      expect(splitPhoneNumber("9876543210", "54")).toEqual({
        dialCode: "54",
        nationalNumber: "9876543210",
      })
    })
  })

  describe("combinePhoneNumber", () => {
    it("returns empty string if national number is empty or contains no digits", () => {
      expect(combinePhoneNumber("57", "")).toBe("")
      expect(combinePhoneNumber("57", "   ")).toBe("")
      expect(combinePhoneNumber("57", "---")).toBe("")
    })

    it("combines dialCode and cleaned national number", () => {
      expect(combinePhoneNumber("57", "3022575805")).toBe("573022575805")
      expect(combinePhoneNumber("+57", "(302) 257-5805")).toBe("573022575805")
      expect(combinePhoneNumber("52", "55 1234 5678")).toBe("525512345678")
      expect(combinePhoneNumber("1", "415-555-2671")).toBe("14155552671")
      expect(combinePhoneNumber("1809", "123-4567")).toBe("18091234567")
    })
  })
})
