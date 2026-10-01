import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { Client } = pg;

const ADMIN_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/burger_page_test';
const SCRATCH_DB = 'hours_migration_scratch';

const migrationsDir = resolve(__dirname, '../../../../database/migrations');

/** Returns the SQL of one "-- ── T7." section (up to the next "-- ── T" marker). */
function section(file: string, id: string): string {
  const sql = readFileSync(resolve(migrationsDir, file), 'utf8');
  const start = sql.indexOf(`-- ── ${id}.`);
  if (start < 0) throw new Error(`section ${id} not found in ${file}`);
  const rest = sql.slice(start + 1);
  const next = rest.search(/\n-- ── T\d+\./);
  return next < 0 ? sql.slice(start) : sql.slice(start, start + 1 + next);
}

const UP = () => section('0000000000008_db_hardening.up.sql', 'T7');
const DOWN = () => section('0000000000008_db_hardening.down.sql', 'T7');

let isDbConnected = false;

describe('T7 hours consolidation migration (data logic on a scratch database)', () => {
  let admin: pg.Client;
  let db: pg.Client;

  const url = (name: string) => ADMIN_URL.replace(/\/[^/]+$/, `/${name}`);

  beforeAll(async () => {
    admin = new Client({ connectionString: ADMIN_URL, connectionTimeoutMillis: 2000 });
    try {
      await admin.connect();
      isDbConnected = true;
      await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)`);
      await admin.query(`CREATE DATABASE ${SCRATCH_DB}`);
      db = new Client({ connectionString: url(SCRATCH_DB) });
      await db.connect();
    } catch (err: any) {
      console.warn(`\n[HoursConsolidationMigration] Skipping: ${err.message}`);
      isDbConnected = false;
    }
  });

  afterAll(async () => {
    await db?.end().catch(() => {});
    if (isDbConnected) await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)`);
    await admin?.end().catch(() => {});
  });

  // The pre-0008 shape of the two tables the migration touches.
  beforeEach(async () => {
    if (!isDbConnected) return;
    await db.query(`
      DROP TABLE IF EXISTS public.restaurant_hours;
      DROP TABLE IF EXISTS public.restaurant_settings;
      DROP TABLE IF EXISTS public.restaurants;
      CREATE TABLE public.restaurants (id TEXT PRIMARY KEY);
      CREATE TABLE public.restaurant_settings (
        restaurant_id TEXT PRIMARY KEY REFERENCES public.restaurants(id),
        opening_hours_text TEXT DEFAULT '12:00 - 22:30',
        open_time TIME DEFAULT '12:00',
        close_time TIME DEFAULT '22:30'
      );
      CREATE TABLE public.restaurant_hours (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
        day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
        open_time TIME,
        close_time TIME,
        is_closed BOOLEAN NOT NULL DEFAULT FALSE,
        CONSTRAINT uq_restaurant_hours_day UNIQUE (restaurant_id, day_of_week),
        CONSTRAINT chk_hours_consistent CHECK (is_closed OR (open_time IS NOT NULL AND close_time IS NOT NULL))
      );
    `);
  });

  const seed = async (id: string, text: string | null, open: string | null, close: string | null) => {
    await db.query(`INSERT INTO public.restaurants (id) VALUES ($1)`, [id]);
    await db.query(
      `INSERT INTO public.restaurant_settings (restaurant_id, opening_hours_text, open_time, close_time) VALUES ($1, $2, $3, $4)`,
      [id, text, open, close]
    );
  };

  const hasColumn = async () =>
    (
      await db.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'restaurant_settings' AND column_name = 'opening_hours_text'`
      )
    ).rowCount === 1;

  const hasHoursTable = async () => (await db.query(`SELECT to_regclass('public.restaurant_hours') AS t`)).rows[0].t !== null;

  it('backfills NULL times from a parseable text, then drops the column and the hours table', async () => {
    if (!isDbConnected) return;
    await seed('r1', '08:30 - 23:15', null, null);
    await db.query(UP());
    const { rows } = await db.query(`SELECT to_char(open_time, 'HH24:MI') AS o, to_char(close_time, 'HH24:MI') AS c FROM public.restaurant_settings`);
    expect(rows).toEqual([{ o: '08:30', c: '23:15' }]);
    expect(await hasColumn()).toBe(false);
    expect(await hasHoursTable()).toBe(false);
  });

  it('accepts a text that only differs from the times by formatting', async () => {
    if (!isDbConnected) return;
    await seed('r1', '9:00 -  22:30', '09:00', '22:30');
    await seed('r2', null, '10:00', '20:00');
    await seed('r3', '12:00 - 22:30', '12:00', '22:30');
    await db.query(UP());
    expect(await hasColumn()).toBe(false);
  });

  it('aborts, changing nothing, when a free-form text would be lost', async () => {
    if (!isDbConnected) return;
    await seed('r1', 'Lun-Vie 8am - 10pm', '12:00', '22:30');
    await expect(db.query(UP())).rejects.toThrow(/opening_hours_text/);
    expect(await hasColumn()).toBe(true);
    expect(await hasHoursTable()).toBe(true);
  });

  it('aborts when a parseable text contradicts the stored times', async () => {
    if (!isDbConnected) return;
    await seed('r1', '08:00 - 20:00', '12:00', '22:30');
    await expect(db.query(UP())).rejects.toThrow(/opening_hours_text/);
    expect(await hasColumn()).toBe(true);
  });

  it('aborts when restaurant_hours still holds rows (nothing silently deleted)', async () => {
    if (!isDbConnected) return;
    await seed('r1', null, '12:00', '22:30');
    await db.query(`INSERT INTO public.restaurant_hours (restaurant_id, day_of_week, is_closed) VALUES ('r1', 0, TRUE)`);
    await expect(db.query(UP())).rejects.toThrow(/restaurant_hours/);
    expect(await hasHoursTable()).toBe(true);
  });

  it('is idempotent: running up twice is a no-op the second time', async () => {
    if (!isDbConnected) return;
    await seed('r1', '12:00 - 22:30', '12:00', '22:30');
    await db.query(UP());
    await db.query(UP());
    expect(await hasColumn()).toBe(false);
  });

  it('down re-adds the text column derived from the times (default restored) and recreates restaurant_hours', async () => {
    if (!isDbConnected) return;
    await seed('r1', '08:30 - 23:15', '08:30', '23:15');
    await seed('r2', null, null, null);
    await db.query(UP());
    // Policies/grants of the recreated table need the app role and helper schema objects.
    await db.query(DOWN());
    const { rows } = await db.query(`SELECT restaurant_id, opening_hours_text FROM public.restaurant_settings ORDER BY restaurant_id`);
    expect(rows).toEqual([
      { restaurant_id: 'r1', opening_hours_text: '08:30 - 23:15' },
      { restaurant_id: 'r2', opening_hours_text: null },
    ]);
    const def = await db.query(
      `SELECT column_default FROM information_schema.columns
       WHERE table_name = 'restaurant_settings' AND column_name = 'opening_hours_text'`
    );
    expect(def.rows[0].column_default).toContain('12:00 - 22:30');
    expect(await hasHoursTable()).toBe(true);
  });
});
