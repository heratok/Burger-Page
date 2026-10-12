import { describe, it, expect } from 'vitest';
import { structureLegacyTables } from '../../src/infrastructure/persistence/sqlite/legacyTableBackfill.js';

const run = (names: string[], restaurantId = 'r1') =>
  structureLegacyTables(names.map((name, i) => ({ id: `t${i}`, restaurantId, name })));

const out = (names: string[]) => {
  const map = run(names);
  return names.map((_, i) => map.get(`t${i}`));
};

describe('structureLegacyTables (SQLite twin of the 0018 backfill)', () => {
  it('parses "<zone> <number>" and normalizes the zone', () => {
    expect(out(['Mesa 4', 'terraza 2', 'Mesa5', '12', 'Salón  principal   7'])).toEqual([
      { zone: 'Mesa', number: 4, alias: null },
      { zone: 'Terraza', number: 2, alias: null },
      { zone: 'Mesa', number: 5, alias: null },
      { zone: 'Mesa', number: 12, alias: null },
      { zone: 'Salón principal', number: 7, alias: null },
    ]);
  });

  it('sends names without a trailing number to Mesa with the next free number and the original as alias', () => {
    expect(out(['VIP', 'Mesa 1', 'Mesa 2'])).toEqual([
      { zone: 'Mesa', number: 3, alias: 'VIP' },
      { zone: 'Mesa', number: 1, alias: null },
      { zone: 'Mesa', number: 2, alias: null },
    ]);
  });

  it('resolves collisions case-insensitively, keeping the first row', () => {
    expect(out(['Mesa 4', 'Mesa 04', 'TERRAZA 1', 'Terraza  01'])).toEqual([
      { zone: 'Mesa', number: 4, alias: null },
      { zone: 'Mesa', number: 1, alias: 'Mesa 04' },
      { zone: 'TERRAZA', number: 1, alias: null },
      { zone: 'Mesa', number: 2, alias: 'Terraza 01' },
    ]);
  });

  it('falls back for numbers outside 1..9999 and zones over 30 characters', () => {
    const longName = `${'Zona'.repeat(9)} 3`;
    expect(out(['Mesa 99999999999', 'Mesa 0', 'Mesa 10000', longName])).toEqual([
      { zone: 'Mesa', number: 1, alias: 'Mesa 99999999999' },
      { zone: 'Mesa', number: 2, alias: 'Mesa 0' },
      { zone: 'Mesa', number: 3, alias: 'Mesa 10000' },
      { zone: 'Mesa', number: 4, alias: longName.slice(0, 30) },
    ]);
  });

  it('numbers each restaurant independently', () => {
    const map = structureLegacyTables([
      { id: 'a', restaurantId: 'r1', name: 'Terraza 1' },
      { id: 'b', restaurantId: 'r2', name: 'Terraza 1' },
    ]);
    expect(map.get('a')).toEqual({ zone: 'Terraza', number: 1, alias: null });
    expect(map.get('b')).toEqual({ zone: 'Terraza', number: 1, alias: null });
  });
});
