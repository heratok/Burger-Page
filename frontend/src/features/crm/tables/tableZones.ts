import {
  MAX_BULK_TABLES,
  MAX_TABLE_NUMBER,
  MIN_TABLE_NUMBER,
  formatTableName,
  normalizeTableZone,
} from "@burger-page/contracts"
import type { RestaurantTable } from "@/types/restaurant"

export const DEFAULT_TABLE_ZONE = "Salón"

const zoneKey = (zone: string): string => normalizeTableZone(zone).toLowerCase()

export const sameZone = (a: string, b: string): boolean => zoneKey(a) === zoneKey(b)

export interface TableGroup {
  zone: string
  tables: RestaurantTable[]
}

/** Groups by zone (case-insensitive) in order of first appearance, keeping the table order. */
export function groupTablesByZone(tables: readonly RestaurantTable[]): TableGroup[] {
  const groups = new Map<string, TableGroup>()
  for (const table of tables) {
    const key = zoneKey(table.zone)
    const group = groups.get(key)
    if (group) group.tables.push(table)
    else groups.set(key, { zone: table.zone, tables: [table] })
  }
  return [...groups.values()]
}

export const distinctZones = (tables: readonly RestaurantTable[]): string[] =>
  groupTablesByZone(tables).map((g) => g.zone)

/** The zone with the most tables (the first one on a tie), or "Salón" when there are none. */
export function defaultZone(tables: readonly RestaurantTable[]): string {
  let best: TableGroup | null = null
  for (const group of groupTablesByZone(tables)) {
    if (!best || group.tables.length > best.tables.length) best = group
  }
  return best?.zone ?? DEFAULT_TABLE_ZONE
}

/** Smallest positive number not used yet in the zone. */
export function nextFreeNumber(tables: readonly RestaurantTable[], zone: string): number {
  const used = new Set(tables.filter((t) => sameZone(t.zone, zone)).map((t) => t.number))
  let candidate = MIN_TABLE_NUMBER
  while (used.has(candidate) && candidate < MAX_TABLE_NUMBER) candidate++
  return candidate
}

const isValidNumber = (n: number): boolean =>
  Number.isInteger(n) && n >= MIN_TABLE_NUMBER && n <= MAX_TABLE_NUMBER

/** Name the server will derive, or null while the input cannot be created. */
export function previewTableName(zone: string, number: number, alias?: string | null): string | null {
  if (!normalizeTableZone(zone) || !isValidNumber(number)) return null
  return formatTableName({ zone, number, alias })
}

export function previewRange(zone: string, from: number, to: number): string | null {
  if (!normalizeTableZone(zone) || !isValidNumber(from) || !isValidNumber(to)) return null
  if (to < from || to - from + 1 > MAX_BULK_TABLES) return null
  const first = formatTableName({ zone, number: from })
  if (from === to) return `Se creará ${first}`
  return `Se crearán ${first} a ${formatTableName({ zone, number: to })}`
}

/** Zones offered as autocomplete: the existing ones, or just "Salón" when there are none. */
export function zoneSuggestions(tables: readonly RestaurantTable[]): string[] {
  const zones = distinctZones(tables)
  return zones.length > 0 ? zones : [DEFAULT_TABLE_ZONE]
}
