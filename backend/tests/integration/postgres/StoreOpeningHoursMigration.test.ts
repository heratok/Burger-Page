import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type pg from 'pg';
import { createScratchDb } from './helpers/scratchDb.js';
import { up0009Section, down0009Section } from './helpers/migrationSection.js';

let db: pg.Client | undefined;
let drop: (() => Promise<void>) | undefined;

describe('0009 store opening hours migration (data logic on a scratch database)', () => {
  beforeAll(async () => {
    const scratch = await createScratchDb('opening_hours_migration_scratch');
    if (scratch) ({ db, drop } = scratch);
  });

  afterAll(async () => {
    await drop?.();
  });

  // The pre-0009 shape of the tables the migration touches. The weekly table
  // is created without RLS/grants (the scratch DB has no app roles/helpers):
  // those parts are covered by the RlsTenantIsolation suite on the real schema.
  beforeEach(async () => {
    if (!db) return;
    await db.query(`
      DROP TABLE IF EXISTS public.restaurant_opening_hours;
      DROP TABLE IF EXISTS public.restaurant_settings;
      DROP TABLE IF EXISTS public.restaurants;
      CREATE TABLE public.restaurants (id TEXT PRIMARY KEY);
      CREATE TABLE public.restaurant_settings (
        restaurant_id TEXT PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
        open_time TIME DEFAULT '12:00',
        close_time TIME DEFAULT '22:30'
      );
      CREATE TABLE public.restaurant_opening_hours (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
        day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
        open_time TIME NOT NULL,
        close_time TIME NOT NULL,
        CONSTRAINT uq_restaurant_opening_hours_range UNIQUE (restaurant_id, day_of_week, open_time)
      );
    `);
  });

  const addRestaurant = async (id: string, open: string | null, close: string | null, withSettings = true) => {
    await db!.query('INSERT INTO public.restaurants (id) VALUES ($1)', [id]);
    if (withSettings) {
      await db!.query('INSERT INTO public.restaurant_settings (restaurant_id, open_time, close_time) VALUES ($1, $2, $3)', [id, open, close]);
    }
  };

  const schedule = async (id: string) =>
    (
      await db!.query(
        `SELECT day_of_week, to_char(open_time, 'HH24:MI') AS open, to_char(close_time, 'HH24:MI') AS close
         FROM public.restaurant_opening_hours WHERE restaurant_id = $1 ORDER BY day_of_week, open_time`,
        [id]
      )
    ).rows;

  const hasColumn = async (name: string) =>
    (
      await db!.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'restaurant_settings' AND column_name = $1`,
        [name]
      )
    ).rowCount === 1;

  it('T3 backfills 7 rows per restaurant with its current hours, then drops open_time/close_time', async () => {
    if (!db) return;
    await addRestaurant('a', '09:00', '21:15');
    await addRestaurant('b', '20:00', '02:00'); // overnight keeps its shape

    await db.query(up0009Section('T3'));

    const a = await schedule('a');
    expect(a.map((r) => r.day_of_week)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(a.every((r) => r.open === '09:00' && r.close === '21:15')).toBe(true);
    const b = await schedule('b');
    expect(b).toHaveLength(7);
    expect(b.every((r) => r.open === '20:00' && r.close === '02:00')).toBe(true);
    expect(await hasColumn('open_time')).toBe(false);
    expect(await hasColumn('close_time')).toBe(false);
  });

  it('T3 uses the 12:00-22:30 defaults for NULL times and for a restaurant without a settings row', async () => {
    if (!db) return;
    await addRestaurant('nulls', null, null);
    await addRestaurant('no-settings', null, null, false);

    await db.query(up0009Section('T3'));

    for (const id of ['nulls', 'no-settings']) {
      const rows = await schedule(id);
      expect(rows).toHaveLength(7);
      expect(rows.every((r) => r.open === '12:00' && r.close === '22:30')).toBe(true);
    }
  });

  it('T3 is idempotent: a second run adds nothing and does not fail on the dropped columns', async () => {
    if (!db) return;
    await addRestaurant('a', '10:00', '20:00');
    await db.query(up0009Section('T3'));
    await db.query(up0009Section('T3'));
    expect(await schedule('a')).toHaveLength(7);
  });

  it('T3 leaves a restaurant that already has rows untouched', async () => {
    if (!db) return;
    await addRestaurant('custom', '10:00', '20:00');
    await db.query(
      `INSERT INTO public.restaurant_opening_hours (restaurant_id, day_of_week, open_time, close_time) VALUES ('custom', 3, '08:00', '12:00')`
    );
    await db.query(up0009Section('T3'));
    expect(await schedule('custom')).toEqual([{ day_of_week: 3, open: '08:00', close: '12:00' }]);
  });

  it('T3 down restores the time columns from the first range of the week and keeps defaults when there are none', async () => {
    if (!db) return;
    await addRestaurant('a', '10:00', '20:00');
    await addRestaurant('empty', '10:00', '20:00');
    await db.query(up0009Section('T3'));
    await db.query(`DELETE FROM public.restaurant_opening_hours WHERE restaurant_id = 'empty'`);
    await db.query(
      `UPDATE public.restaurant_opening_hours SET open_time = '11:30', close_time = '23:00' WHERE restaurant_id = 'a' AND day_of_week = 0`
    );

    await db.query(down0009Section('T3'));

    const { rows } = await db.query(
      `SELECT restaurant_id, to_char(open_time, 'HH24:MI') AS open, to_char(close_time, 'HH24:MI') AS close
       FROM public.restaurant_settings ORDER BY restaurant_id`
    );
    expect(rows).toEqual([
      { restaurant_id: 'a', open: '11:30', close: '23:00' },
      { restaurant_id: 'empty', open: '12:00', close: '22:30' },
    ]);
  });

  it('T1 adds timezone and orders_paused with defaults and rejects a malformed timezone', async () => {
    if (!db) return;
    await addRestaurant('a', '10:00', '20:00');
    await db.query(up0009Section('T1'));

    const { rows } = await db.query('SELECT timezone, orders_paused FROM public.restaurant_settings');
    expect(rows).toEqual([{ timezone: 'America/Bogota', orders_paused: false }]);

    await expect(
      db.query(`UPDATE public.restaurant_settings SET timezone = 'not a zone!' WHERE restaurant_id = 'a'`)
    ).rejects.toMatchObject({ code: '23514' });
    await db.query(`UPDATE public.restaurant_settings SET timezone = 'Etc/GMT+5' WHERE restaurant_id = 'a'`);
  });

  it('T1 down removes the columns and the CHECK', async () => {
    if (!db) return;
    await addRestaurant('a', '10:00', '20:00');
    await db.query(up0009Section('T1'));
    await db.query(down0009Section('T1'));
    expect(await hasColumn('timezone')).toBe(false);
    expect(await hasColumn('orders_paused')).toBe(false);
  });
});
