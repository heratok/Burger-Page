import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { upSection, downSection } from './helpers/migrationSection.js';
import { createScratchDb, ADMIN_URL } from './helpers/scratchDb.js';

const { Pool } = pg;

describe('orders.final_total = subtotal + delivery_fee (db-hardening-0008 T9)', () => {
  let pool: pg.Pool;
  let isDbConnected = false;
  const RESTAURANT = `tot-rest-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    pool = new Pool({ connectionString: ADMIN_URL, connectionTimeoutMillis: 2000 });
    try {
      await pool.query('SELECT 1');
      isDbConnected = true;
      await pool.query(`INSERT INTO public.restaurants (id, slug, name, is_active) VALUES ($1, $1, 'Total Test', true)`, [RESTAURANT]);
    } catch (err: any) {
      console.warn(`\n[OrderTotalConsistency] Skipping: ${err.message}`);
    }
  });

  afterAll(async () => {
    if (isDbConnected) {
      await pool.query(`DELETE FROM public.orders WHERE restaurant_id = $1`, [RESTAURANT]);
      await pool.query(`DELETE FROM public.restaurants WHERE id = $1`, [RESTAURANT]);
    }
    await pool?.end();
  });

  const insert = (id: string, subtotal: number, fee: number, total: number) =>
    pool.query(
      `INSERT INTO public.orders (id, restaurant_id, subtotal, delivery_fee, final_total) VALUES ($1, $2, $3, $4, $5)`,
      [id, RESTAURANT, subtotal, fee, total]
    );

  it('accepts a consistent total', async () => {
    if (!isDbConnected) return;
    await insert(`tot-ok-${randomUUID().slice(0, 8)}`, 100, 5, 105);
  });

  it('rejects an insert whose final_total differs from subtotal + delivery_fee (23514)', async () => {
    if (!isDbConnected) return;
    await expect(insert(`tot-bad-${randomUUID().slice(0, 8)}`, 100, 5, 100)).rejects.toMatchObject({
      code: '23514',
      constraint: 'chk_orders_final_total',
    });
  });

  it('rejects an update that breaks the invariant, and one that keeps it', async () => {
    if (!isDbConnected) return;
    const id = `tot-upd-${randomUUID().slice(0, 8)}`;
    await insert(id, 100, 5, 105);
    await expect(pool.query(`UPDATE public.orders SET final_total = 999 WHERE id = $1`, [id])).rejects.toMatchObject({
      code: '23514',
    });
    await pool.query(`UPDATE public.orders SET subtotal = 200, final_total = 205 WHERE id = $1`, [id]);
  });

  it('create_order_atomic keeps the invariant (header insert and final totals update)', async () => {
    if (!isDbConnected) return;
    const productId = `tot-prod-${randomUUID().slice(0, 8)}`;
    await pool.query(
      `INSERT INTO public.restaurant_settings (restaurant_id, delivery_fee) VALUES ($1, 7) ON CONFLICT (restaurant_id) DO UPDATE SET delivery_fee = 7`,
      [RESTAURANT]
    );
    await pool.query(`INSERT INTO public.products (id, restaurant_id, name, price, is_available) VALUES ($1, $2, 'P', 12.50, true)`, [productId, RESTAURANT]);
    const orderId = `tot-rpc-${randomUUID().slice(0, 8)}`;
    const items = JSON.stringify([{ id: `${orderId}-i1`, product_id: productId, quantity: 3 }]);
    for (const fee of [null, 0, 3.25]) {
      const id = fee === null ? orderId : `${orderId}-${fee}`;
      await pool.query(
        `SELECT public.create_order_atomic($1, $2, NULL, 'Efectivo', NULL, NULL, NULL, $3::jsonb, $4, NULL)`,
        [id, RESTAURANT, items.replace(`${orderId}-i1`, `${id}-i1`), fee]
      );
      const { rows } = await pool.query(`SELECT subtotal, delivery_fee, final_total FROM public.orders WHERE id = $1`, [id]);
      expect(Number(rows[0].final_total)).toBe(Number(rows[0].subtotal) + Number(rows[0].delivery_fee));
    }
  });
});

describe('T9 migration on a scratch database', () => {
  let scratch: Awaited<ReturnType<typeof createScratchDb>>;

  beforeAll(async () => {
    scratch = await createScratchDb('order_total_migration_scratch');
  });
  afterAll(async () => {
    await scratch?.drop();
  });

  beforeEach(async () => {
    if (!scratch) return;
    await scratch.db.query(`
      DROP TABLE IF EXISTS public.orders;
      CREATE TABLE public.orders (
        id TEXT PRIMARY KEY, subtotal NUMERIC(12,2) NOT NULL, delivery_fee NUMERIC(12,2) NOT NULL, final_total NUMERIC(12,2) NOT NULL
      );
    `);
  });

  it('adds and validates the constraint on consistent data, idempotently; down removes it', async () => {
    if (!scratch) return;
    await scratch.db.query(`INSERT INTO public.orders VALUES ('a', 10, 2, 12)`);
    await scratch.db.query(upSection('T9'));
    await scratch.db.query(upSection('T9'));
    const { rows } = await scratch.db.query(`SELECT convalidated FROM pg_constraint WHERE conname = 'chk_orders_final_total'`);
    expect(rows).toEqual([{ convalidated: true }]);
    await scratch.db.query(downSection('T9'));
    expect((await scratch.db.query(`SELECT 1 FROM pg_constraint WHERE conname = 'chk_orders_final_total'`)).rowCount).toBe(0);
  });

  it('aborts with a readable message, changing nothing, when existing orders violate the invariant', async () => {
    if (!scratch) return;
    await scratch.db.query(`INSERT INTO public.orders VALUES ('ok', 10, 2, 12), ('bad', 10, 2, 99)`);
    await expect(scratch.db.query(upSection('T9'))).rejects.toThrow(/chk_orders_final_total.*1 order/s);
    expect((await scratch.db.query(`SELECT 1 FROM pg_constraint WHERE conname = 'chk_orders_final_total'`)).rowCount).toBe(0);
  });
});
