import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import pg from 'pg';
import { upSection, downSection } from './helpers/migrationSection.js';

const { Client, Pool } = pg;

const ADMIN_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/burger_page_test';

let isDbConnected = false;

const COLUMNS: Array<[string, string]> = [
  ['customers', 'email'],
  ['customers', 'address'],
  ['customers', 'barrio'],
  ['products', 'description'],
  ['suppliers', 'contact_name'],
  ['suppliers', 'phone'],
  ['suppliers', 'email'],
];

describe("optional text columns use NULL, not '' (db-hardening-0008 T8)", () => {
  it('the live schema declares no empty-string default on those columns', async () => {
    const pool = new Pool({ connectionString: ADMIN_URL, connectionTimeoutMillis: 2000 });
    try {
      await pool.query('SELECT 1');
    } catch {
      await pool.end();
      return;
    }
    try {
      for (const [table, column] of COLUMNS) {
        const { rows } = await pool.query(
          `SELECT column_default, is_nullable FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
          [table, column]
        );
        expect(rows[0], `${table}.${column}`).toEqual({ column_default: null, is_nullable: 'YES' });
      }
    } finally {
      await pool.end();
    }
  });
});

describe("T8 migration data logic on a scratch database ('' <-> NULL)", () => {
  const SCRATCH_DB = 'empty_strings_migration_scratch';
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
      console.warn(`\n[EmptyStringsToNullMigration] Skipping: ${err.message}`);
      isDbConnected = false;
    }
  });

  afterAll(async () => {
    await db?.end().catch(() => {});
    if (isDbConnected) await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)`);
    await admin?.end().catch(() => {});
  });

  // The pre-0008 shape of the touched columns (the '' defaults).
  beforeEach(async () => {
    if (!isDbConnected) return;
    await db.query(`
      DROP TABLE IF EXISTS public.customers, public.products, public.suppliers;
      CREATE TABLE public.customers (id TEXT PRIMARY KEY, email TEXT DEFAULT '', address TEXT DEFAULT '', barrio TEXT DEFAULT '');
      CREATE TABLE public.products (id TEXT PRIMARY KEY, description TEXT DEFAULT '');
      CREATE TABLE public.suppliers (id TEXT PRIMARY KEY, contact_name TEXT DEFAULT '', phone TEXT DEFAULT '', email TEXT DEFAULT '');
      INSERT INTO public.customers (id) VALUES ('c-default');
      INSERT INTO public.customers (id, email, address, barrio) VALUES ('c-set', 'a@b.co', 'Calle 1', 'Centro');
      INSERT INTO public.products (id) VALUES ('p-default');
      INSERT INTO public.products (id, description) VALUES ('p-set', 'Beef');
      INSERT INTO public.suppliers (id) VALUES ('s-default');
      INSERT INTO public.suppliers (id, contact_name, phone, email) VALUES ('s-set', 'Ana', '300', 'x@y.co');
    `);
  });

  const row = async (table: string, id: string) => (await db.query(`SELECT * FROM public.${table} WHERE id = $1`, [id])).rows[0];

  it("up turns '' into NULL, keeps real values and drops the defaults", async () => {
    if (!isDbConnected) return;
    await db.query(upSection('T8'));
    expect(await row('customers', 'c-default')).toEqual({ id: 'c-default', email: null, address: null, barrio: null });
    expect(await row('customers', 'c-set')).toEqual({ id: 'c-set', email: 'a@b.co', address: 'Calle 1', barrio: 'Centro' });
    expect(await row('products', 'p-default')).toEqual({ id: 'p-default', description: null });
    expect(await row('products', 'p-set')).toEqual({ id: 'p-set', description: 'Beef' });
    expect(await row('suppliers', 's-default')).toEqual({ id: 's-default', contact_name: null, phone: null, email: null });
    await db.query(`INSERT INTO public.customers (id) VALUES ('c-new')`);
    expect((await row('customers', 'c-new')).email).toBeNull();
  });

  it('is idempotent', async () => {
    if (!isDbConnected) return;
    await db.query(upSection('T8'));
    await db.query(upSection('T8'));
    expect((await row('customers', 'c-default')).email).toBeNull();
  });

  it("down restores the '' defaults and turns NULL back into ''", async () => {
    if (!isDbConnected) return;
    await db.query(upSection('T8'));
    await db.query(downSection('T8'));
    expect(await row('customers', 'c-default')).toEqual({ id: 'c-default', email: '', address: '', barrio: '' });
    expect(await row('suppliers', 's-default')).toEqual({ id: 's-default', contact_name: '', phone: '', email: '' });
    await db.query(`INSERT INTO public.products (id) VALUES ('p-new')`);
    expect((await row('products', 'p-new')).description).toBe('');
  });
});
