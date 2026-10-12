import { describe, it, expect } from "vitest"
import {
  DEFAULT_TABLE_ZONE,
  defaultZone,
  distinctZones,
  groupTablesByZone,
  nextFreeNumber,
  previewRange,
  previewTableName,
  sameZone,
  zoneSuggestions,
} from "./tableZones"
import type { RestaurantTable } from "@/types/restaurant"

const t = (id: string, zone: string, number: number, extra: Partial<RestaurantTable> = {}): RestaurantTable => ({
  id,
  zone,
  number,
  alias: null,
  name: `${zone} ${number}`,
  sortOrder: 0,
  isActive: true,
  ...extra,
})

describe("tableZones", () => {
  it("compares zones ignoring case and extra spaces", () => {
    expect(sameZone("Terraza", "  terraza ")).toBe(true)
    expect(sameZone("Terraza", "Salón")).toBe(false)
  })

  it("lists distinct zones in order of first appearance", () => {
    const tables = [t("a", "Salón", 1), t("b", "Terraza", 1), t("c", "salón", 2)]
    expect(distinctZones(tables)).toEqual(["Salón", "Terraza"])
  })

  it("picks the most used zone, the first one on a tie, and Salón when empty", () => {
    expect(defaultZone([])).toBe(DEFAULT_TABLE_ZONE)
    expect(defaultZone([t("a", "Salón", 1), t("b", "Terraza", 1)])).toBe("Salón")
    expect(defaultZone([t("a", "Salón", 1), t("b", "Terraza", 1), t("c", "Terraza", 2)])).toBe("Terraza")
  })

  it("suggests the smallest free number of the zone", () => {
    const tables = [t("a", "Terraza", 1), t("b", "Terraza", 2), t("c", "Salón", 7)]
    expect(nextFreeNumber(tables, "Terraza")).toBe(3)
    expect(nextFreeNumber(tables, " terraza ")).toBe(3)
    expect(nextFreeNumber(tables, "Barra")).toBe(1)
    expect(nextFreeNumber([t("a", "Barra", 1), t("b", "Barra", 3)], "Barra")).toBe(2)
  })

  it("groups tables by zone keeping the first-seen zone order and the table order", () => {
    const tables = [t("a", "Salón", 1), t("b", "Terraza", 1), t("c", "salón", 2)]
    const groups = groupTablesByZone(tables)
    expect(groups.map((g) => g.zone)).toEqual(["Salón", "Terraza"])
    expect(groups[0].tables.map((x) => x.id)).toEqual(["a", "c"])
    expect(groups[1].tables.map((x) => x.id)).toEqual(["b"])
  })

  it("previews the derived name and returns null for an invalid input", () => {
    expect(previewTableName("  terraza ", 5)).toBe("Terraza 5")
    expect(previewTableName("Terraza", 5, " VIP ")).toBe("Terraza 5 · VIP")
    expect(previewTableName("", 5)).toBeNull()
    expect(previewTableName("Terraza", 0)).toBeNull()
    expect(previewTableName("Terraza", 1.5)).toBeNull()
    expect(previewTableName("Terraza", 10000)).toBeNull()
  })

  it("previews a range and rejects invalid or oversized ones", () => {
    expect(previewRange("terraza", 1, 10)).toBe("Se crearán Terraza 1 a Terraza 10")
    expect(previewRange("Terraza", 3, 3)).toBe("Se creará Terraza 3")
    expect(previewRange("Terraza", 5, 2)).toBeNull()
    expect(previewRange("Terraza", 1, 101)).toBeNull()
    expect(previewRange("", 1, 3)).toBeNull()
  })
})

describe("zoneSuggestions", () => {
  it("offers the existing zones, or Salón when there are none", () => {
    expect(zoneSuggestions([])).toEqual([DEFAULT_TABLE_ZONE])
    expect(zoneSuggestions([t("a", "Terraza", 1)])).toEqual(["Terraza"])
  })
})
