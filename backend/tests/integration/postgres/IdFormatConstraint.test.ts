import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { upSection, downSection } from './helpers/migrationSection.js';
import { createScratchDb, ADMIN_URL } from './helpers/scratchDb.js';

const { Pool } = pg;

const TABLES = [
  'restaurants',
  'users',
  'categories',
  'products',
  'product_additions',
  'customers',
  'orders',
  'order_status_history',
  'order_items',
  'order_item_additions',
  'suppliers',
  'inventory_items',
];

describe('primary key id format CHECK (db-hardening-0008 T10)', () => {
  let pool: pg.Pool;
  let isDbConnected = false;

  beforeAll(async () => {
    pool = new Pool({ connectionString: ADMIN_URL, connectionTimeoutMillis: 2000 });
    try {
      await pool.query('SELECT 1');
      isDbConnected = true;
    } catch (err: any) {
      console.warn(`\n[IdFormatConstraint] Skipping: ${err.message}`);
    }
  });

  afterAll(async () => {
    await pool?.end();
  });

  it.each(TABLES)('%s has a validated chk_<table>_id_format constraint', async (table) => {
    if (!isDbConnected) return;
    const { rows } = await pool.query(
      `SELECT convalidated, pg_get_constraintdef(oid) AS def FROM pg_constraint
       WHERE conrelid = $1::regclass AND conname = $2`,
      [`public.${table}`, `chk_${table}_id_format`]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].convalidated).toBe(true);
    expect(rows[0].def).toContain('^[A-Za-z0-9_-]{1,64}$');
  });

  describe('enforcement (restaurants as the representative table)', () => {
    const insert = (id: string) =>
      pool.query(`INSERT INTO public.restaurants (id, slug, name) VALUES ($1, $2, 'Id Format Test')`, [id, `slug-${randomUUID()}`]);

    afterAll(async () => {
      if (isDbConnected) await pool.query(`DELETE FROM public.restaurants WHERE name = 'Id Format Test'`);
    });

    it.each([
      ['letters, digits, underscore and hyphen', `rest_${randomUUID()}`],
      ['a single character', 'x'],
      ['exactly 64 characters', 'a'.repeat(64)],
    ])('accepts %s', async (_label, id) => {
      if (!isDbConnected) return;
      await insert(id);
    });

    it.each([
      ['an empty id', ''],
      ['65 characters', 'a'.repeat(65)],
      ['a space', 'has space'],
      ['a dot', 'has.dot'],
      ['a colon', 'ord:123'],
      ['a slash', 'a/b'],
      ['a quote', "a'b"],
      ['a newline', 'a\nb'],
    ])('rejects %s with 23514', async (_label, id) => {
      if (!isDbConnected) return;
      await expect(insert(id)).rejects.toMatchObject({ code: '23514', constraint: 'chk_restaurants_id_format' });
    });
  });
});

describe('T10 migration on a scratch database', () => {
  let scratch: Awaited<ReturnType<typeof createScratchDb>>;

  beforeAll(async () => {
    scratch = await createScratchDb('id_format_migration_scratch');
  });
  afterAll(async () => {
    await scratch?.drop();
  });

  beforeEach(async () => {
    if (!scratch) return;
    const ddl = TABLES.map((t) => `DROP TABLE IF EXISTS public.${t} CASCADE; CREATE TABLE public.${t} (id TEXT PRIMARY KEY);`).join('\n');
    await scratch.db.query(ddl);
  });

  it('adds and validates one constraint per table, idempotently; down removes them all', async () => {
    if (!scratch) return;
    await scratch.db.query(`INSERT INTO public.products (id) VALUES ('prod_0190a7f0-aaaa-7bbb-8ccc-000000000001')`);
    await scratch.db.query(upSection('T10'));
    await scratch.db.query(upSection('T10'));
    const { rows } = await scratch.db.query(
      `SELECT count(*)::int AS n FROM pg_constraint WHERE conname LIKE 'chk\\_%\\_id\\_format' AND convalidated`
    );
    expect(rows[0].n).toBe(TABLES.length);
    await scratch.db.query(downSection('T10'));
    const after = await scratch.db.query(`SELECT count(*)::int AS n FROM pg_constraint WHERE conname LIKE 'chk\\_%\\_id\\_format'`);
    expect(after.rows[0].n).toBe(0);
  });

  it('aborts with the table and a sample of offending ids, changing nothing', async () => {
    if (!scratch) return;
    await scratch.db.query(`INSERT INTO public.orders (id) VALUES ('ok-1'), ('bad id with spaces')`);
    await expect(scratch.db.query(upSection('T10'))).rejects.toThrow(/orders.*bad id with spaces/s);
    const { rows } = await scratch.db.query(`SELECT count(*)::int AS n FROM pg_constraint WHERE conname LIKE 'chk\\_%\\_id\\_format'`);
    expect(rows[0].n).toBe(0);
  });
});
