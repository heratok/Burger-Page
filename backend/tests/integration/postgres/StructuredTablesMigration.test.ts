import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type pg from 'pg';
import { createScratchDb } from './helpers/scratchDb.js';
import { up0018Section, down0018Section } from './helpers/migrationSection.js';

let db: pg.Client | undefined;
let drop: (() => Promise<void>) | undefined;

const REST = 'r1';
const REST_2 = 'r2';

describe('0018 structured restaurant tables migration (data logic on a scratch database)', () => {
  beforeAll(async () => {
    const scratch = await createScratchDb('structured_tables_migration_scratch');
    if (scratch) ({ db, drop } = scratch);
  });

  afterAll(async () => {
    await drop?.();
  });

  // The pre-0018 shape (migration 0010) without RLS/grants: the scratch DB has
  // no app roles. Policies/grants are untouched by 0018.
  beforeEach(async () => {
    if (!db) return;
    await db.query(`
      DROP TABLE IF EXISTS public.restaurant_tables;
      DROP TABLE IF EXISTS public.restaurants;
      CREATE TABLE public.restaurants (id TEXT PRIMARY KEY);
      CREATE TABLE public.restaurant_tables (
        id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
        name          TEXT NOT NULL,
        sort_order    INTEGER NOT NULL DEFAULT 0,
        is_active     BOOLEAN NOT NULL DEFAULT TRUE,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_restaurant_tables_id_format CHECK (id ~ '^[A-Za-z0-9_-]{1,64}$'),
        CONSTRAINT chk_restaurant_tables_name CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
        CONSTRAINT uq_restaurant_tables_id_restaurant UNIQUE (id, restaurant_id)
      );
      CREATE UNIQUE INDEX uq_restaurant_tables_name ON public.restaurant_tables (restaurant_id, lower(btrim(name)));
      CREATE INDEX idx_restaurant_tables_order ON public.restaurant_tables (restaurant_id, sort_order);
      INSERT INTO public.restaurants (id) VALUES ('${REST}'), ('${REST_2}');
    `);
  });

  const seed = async (restaurantId: string, names: string[]) => {
    for (const [i, name] of names.entries()) {
      await db!.query(
        `INSERT INTO public.restaurant_tables (id, restaurant_id, name, sort_order) VALUES ($1, $2, $3, $4)`,
        [`t_${restaurantId}_${i}`, restaurantId, name, i]
      );
    }
  };

  const migrateUp = async () => {
    for (const s of ['T1', 'T2', 'T3']) await db!.query(up0018Section(s));
  };

  const rows = async (restaurantId = REST) =>
    (
      await db!.query(
        `SELECT id, name AS "oldName", zone, number, alias, name FROM public.restaurant_tables WHERE restaurant_id = $1 ORDER BY sort_order`,
        [restaurantId]
      )
    ).rows;

  const summary = async (restaurantId = REST) =>
    (await rows(restaurantId)).map((r) => [r.zone, r.number, r.alias, r.name]);

  it('T2 parses "<zone> <number>" and normalizes the zone', async () => {
    if (!db) return;
    await seed(REST, ['Mesa 4', 'terraza 2', 'Mesa5', '12', 'Salón  principal   7']);
    await migrateUp();
    expect(await summary()).toEqual([
      ['Mesa', 4, null, 'Mesa 4'],
      ['Terraza', 2, null, 'Terraza 2'],
      ['Mesa', 5, null, 'Mesa 5'],
      ['Mesa', 12, null, 'Mesa 12'],
      ['Salón principal', 7, null, 'Salón principal 7'],
    ]);
  });

  it('T2 moves names without a trailing number to zone Mesa, next free number, keeping the original as alias', async () => {
    if (!db) return;
    // VIP is listed first but must not steal the number of a later "Mesa 1".
    await seed(REST, ['VIP', 'Mesa 1', 'Mesa 2']);
    await migrateUp();
    expect(await summary()).toEqual([
      ['Mesa', 3, 'VIP', 'Mesa 3 · VIP'],
      ['Mesa', 1, null, 'Mesa 1'],
      ['Mesa', 2, null, 'Mesa 2'],
    ]);
  });

  it('T2 resolves a (zone, number) collision by sending the later row to the next free Mesa number with an alias', async () => {
    if (!db) return;
    await seed(REST, ['Mesa 4', 'Mesa 04']);
    await migrateUp();
    expect(await summary()).toEqual([
      ['Mesa', 4, null, 'Mesa 4'],
      ['Mesa', 1, 'Mesa 04', 'Mesa 1 · Mesa 04'],
    ]);
  });

  it('T2 falls back for numbers that do not fit 1..9999 and for zones longer than 30 chars', async () => {
    if (!db) return;
    await seed(REST, ['Mesa 99999999999', 'Mesa 0', 'Mesa 10000', `${'Zona'.repeat(9)} 3`]);
    await migrateUp();
    const out = await rows();
    expect(out.map((r) => [r.zone, r.number])).toEqual([
      ['Mesa', 1],
      ['Mesa', 2],
      ['Mesa', 3],
      ['Mesa', 4],
    ]);
    expect(out.map((r) => r.alias)).toEqual(['Mesa 99999999999', 'Mesa 0', 'Mesa 10000', `${'Zona'.repeat(9)} 3`.slice(0, 30)]);
    expect(out.every((r) => r.name.length <= 68)).toBe(true);
  });

  it('T2 treats zones case-insensitively when detecting collisions and numbers per restaurant independently', async () => {
    if (!db) return;
    await seed(REST, ['TERRAZA 1', 'Terraza  01']);
    await seed(REST_2, ['Terraza 1']);
    await migrateUp();
    expect(await summary(REST)).toEqual([
      ['TERRAZA', 1, null, 'TERRAZA 1'],
      ['Mesa', 1, 'Terraza 01', 'Mesa 1 · Terraza 01'],
    ]);
    expect(await summary(REST_2)).toEqual([['Terraza', 1, null, 'Terraza 1']]);
  });

  it('T3 enforces NOT NULL, ranges and unique (restaurant, lower(zone), number) afterwards', async () => {
    if (!db) return;
    await seed(REST, ['Mesa 1']);
    await migrateUp();
    const insert = (id: string, zone: string | null, number: number | null, alias: string | null = null, rest = REST) =>
      db!.query(
        `INSERT INTO public.restaurant_tables (id, restaurant_id, name, zone, number, alias) VALUES ($1, $2, 'x', $3, $4, $5)`,
        [id, rest, zone, number, alias]
      );
    await expect(insert('a', 'mesa', 1)).rejects.toMatchObject({ code: '23505' });
    await expect(insert('b', ' MESA ', 1)).rejects.toMatchObject({ code: '23505' });
    await expect(insert('c', 'Mesa', 0)).rejects.toMatchObject({ code: '23514' });
    await expect(insert('d', 'Mesa', 10000)).rejects.toMatchObject({ code: '23514' });
    await expect(insert('e', '   ', 5)).rejects.toMatchObject({ code: '23514' });
    await expect(insert('f', 'Z'.repeat(31), 5)).rejects.toMatchObject({ code: '23514' });
    await expect(insert('g', 'Mesa', 5, 'a'.repeat(31))).rejects.toMatchObject({ code: '23514' });
    await expect(insert('h', 'Mesa', 5, '')).rejects.toMatchObject({ code: '23514' });
    await expect(insert('i', null, 5)).rejects.toMatchObject({ code: '23502' });
    await expect(insert('j', 'Mesa', null)).rejects.toMatchObject({ code: '23502' });
    await insert('k', 'Mesa', 1, null, REST_2); // other restaurant: fine
    await insert('l', 'Mesa', 5, 'a'.repeat(30));
  });

  it('T3 widens the name check to fit zone(30) + number(4) + alias(30) and drops the old name index', async () => {
    if (!db) return;
    await migrateUp();
    const name = `${'Z'.repeat(30)} 9999 · ${'a'.repeat(30)}`;
    expect(name.length).toBe(68);
    await db.query(
      `INSERT INTO public.restaurant_tables (id, restaurant_id, name, zone, number, alias) VALUES ('w', $1, $2, $3, 9999, $4)`,
      [REST, name, 'Z'.repeat(30), 'a'.repeat(30)]
    );
    await expect(
      db.query(`INSERT INTO public.restaurant_tables (id, restaurant_id, name, zone, number) VALUES ('w2', $1, $2, 'Mesa', 1)`, [REST, 'n'.repeat(69)])
    ).rejects.toMatchObject({ code: '23514' });
    const idx = (await db.query(`SELECT indexname FROM pg_indexes WHERE tablename = 'restaurant_tables' ORDER BY indexname`)).rows.map((r) => r.indexname);
    expect(idx).toContain('uq_restaurant_tables_zone_number');
    expect(idx).not.toContain('uq_restaurant_tables_name');
  });

  it('is idempotent: running the up sections twice changes nothing', async () => {
    if (!db) return;
    await seed(REST, ['Mesa 4', 'VIP', 'terraza 2']);
    await migrateUp();
    const first = await summary();
    await migrateUp();
    expect(await summary()).toEqual(first);
  });

  it('down restores the 0010 shape, keeping the derived names', async () => {
    if (!db) return;
    await seed(REST, ['Mesa 4', 'VIP']);
    await migrateUp();
    for (const s of ['T3', 'T2', 'T1']) await db.query(down0018Section(s));
    const cols = (
      await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'restaurant_tables'`)
    ).rows.map((r) => r.column_name);
    expect(cols).not.toContain('zone');
    expect(cols).not.toContain('number');
    expect(cols).not.toContain('alias');
    const names = (await db.query(`SELECT name FROM public.restaurant_tables ORDER BY sort_order`)).rows.map((r) => r.name);
    expect(names).toEqual(['Mesa 4', 'Mesa 1 · VIP']);
    await expect(
      db.query(`INSERT INTO public.restaurant_tables (id, restaurant_id, name) VALUES ('dup', $1, ' mesa 4 ')`, [REST])
    ).rejects.toMatchObject({ code: '23505' });
    await expect(
      db.query(`INSERT INTO public.restaurant_tables (id, restaurant_id, name) VALUES ('long', $1, $2)`, [REST, 'n'.repeat(41)])
    ).rejects.toMatchObject({ code: '23514' });
  });
});
