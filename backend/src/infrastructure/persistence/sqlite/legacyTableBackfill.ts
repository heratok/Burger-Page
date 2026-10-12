import { MAX_TABLE_ALIAS_LENGTH, MAX_TABLE_NUMBER, MAX_TABLE_ZONE_LENGTH, normalizeTableZone } from '@burger-page/contracts';

export interface LegacyTableRow {
  id: string;
  restaurantId: string;
  name: string;
}

export interface StructuredTable {
  zone: string;
  number: number;
  alias: string | null;
}

const FALLBACK_ZONE = 'Mesa';
const zoneKey = (zone: string) => zone.trim().toLowerCase();

/**
 * SQLite twin of the PostgreSQL 0018 backfill. `rows` must already be in list
 * order (sort_order, created_at, id). Pass 1 parses "<zone> <number>" names;
 * pass 2 sends everything else (no trailing number, number out of 1..9999,
 * zone over 30 characters, or a collision) to zone "Mesa" with the lowest
 * free number and the original text as alias. Never throws on bad data.
 */
export function structureLegacyTables(rows: LegacyTableRow[]): Map<string, StructuredTable> {
  const result = new Map<string, StructuredTable>();
  const taken = new Set<string>();
  const key = (restaurantId: string, zone: string, number: number) => `${restaurantId}\u0000${zoneKey(zone)}\u0000${number}`;
  const clean = (name: string) => name.replace(/\s+/g, ' ').trim();

  for (const row of rows) {
    const text = clean(row.name);
    const digits = /(\d+)$/.exec(text)?.[1];
    if (!digits) continue;
    const stripped = digits.replace(/^0+/, '');
    if (stripped.length < 1 || stripped.length > 4) continue;
    const number = Number(stripped);
    if (number > MAX_TABLE_NUMBER) continue;
    const prefix = text.slice(0, text.length - digits.length).replace(/[\s#.:-]+$/, '').trim();
    const zone = prefix === '' ? FALLBACK_ZONE : normalizeTableZone(prefix);
    if (zone.length > MAX_TABLE_ZONE_LENGTH) continue;
    const k = key(row.restaurantId, zone, number);
    if (taken.has(k)) continue;
    taken.add(k);
    result.set(row.id, { zone, number, alias: null });
  }

  for (const row of rows) {
    if (result.has(row.id)) continue;
    let number = 1;
    while (taken.has(key(row.restaurantId, FALLBACK_ZONE, number))) number += 1;
    taken.add(key(row.restaurantId, FALLBACK_ZONE, number));
    result.set(row.id, { zone: FALLBACK_ZONE, number, alias: clean(row.name).slice(0, MAX_TABLE_ALIAS_LENGTH) });
  }
  return result;
}
