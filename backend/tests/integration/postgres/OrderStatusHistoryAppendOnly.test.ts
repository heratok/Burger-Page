import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/burger_page_test';
const APP_USER_DATABASE_URL =
  process.env.APP_USER_DATABASE_URL || 'postgres://app_user:app_user_test_only@localhost:5432/burger_page_test';

let isDbConnected = false;

describe('order_status_history is append-only for app_user (db-hardening-0008 T5)', () => {
  let adminPool: pg.Pool;
  let appPool: pg.Pool;
  const RESTAURANT = `hist-rest-${randomUUID().slice(0, 8)}`;
  const ORDER = `hist-order-${randomUUID().slice(0, 8)}`;

  async function asTenant<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await appPool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.restaurant_id', $1, true)", [RESTAURANT]);
      const out = await fn(client);
      await client.query('COMMIT');
      return out;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  beforeAll(async () => {
    adminPool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2000 });
    appPool = new Pool({ connectionString: APP_USER_DATABASE_URL, connectionTimeoutMillis: 2000 });
    try {
      await adminPool.query('SELECT 1');
      isDbConnected = true;
      await adminPool.query(`INSERT INTO public.restaurants (id, slug, name, is_active) VALUES ($1, $1, 'Hist Test', true)`, [RESTAURANT]);
      // The AFTER INSERT trigger writes the first history row.
      await adminPool.query(
        `INSERT INTO public.orders (id, restaurant_id, subtotal, delivery_fee, final_total) VALUES ($1, $2, 10, 0, 10)`,
        [ORDER, RESTAURANT]
      );
    } catch (err: any) {
      console.warn(`\n[OrderStatusHistoryAppendOnly] Skipping: cannot connect (${err.message}).`);
      isDbConnected = false;
    }
  });

  afterAll(async () => {
    if (isDbConnected) {
      await adminPool.query(`DELETE FROM public.orders WHERE restaurant_id = $1`, [RESTAURANT]);
      await adminPool.query(`DELETE FROM public.restaurants WHERE id = $1`, [RESTAURANT]);
    }
    await adminPool?.end();
    await appPool?.end();
  });

  it('app_user can still read the history of its own tenant', async () => {
    if (!isDbConnected) return;
    const r = await asTenant((c) => c.query(`SELECT new_status FROM public.order_status_history WHERE order_id = $1`, [ORDER]));
    expect(r.rows).toEqual([{ new_status: 'pending' }]);
  });

  it('app_user cannot UPDATE a history row', async () => {
    if (!isDbConnected) return;
    await expect(
      asTenant((c) => c.query(`UPDATE public.order_status_history SET new_status = 'delivered' WHERE order_id = $1`, [ORDER]))
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('app_user cannot DELETE a history row', async () => {
    if (!isDbConnected) return;
    await expect(
      asTenant((c) => c.query(`DELETE FROM public.order_status_history WHERE order_id = $1`, [ORDER]))
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('the BEFORE UPDATE guard also stops roles that hold the UPDATE privilege', async () => {
    if (!isDbConnected) return;
    await expect(
      adminPool.query(`UPDATE public.order_status_history SET new_status = 'delivered' WHERE order_id = $1`, [ORDER])
    ).rejects.toMatchObject({ code: '42501', message: expect.stringContaining('append-only') });
  });

  it('a status change still appends a history row through the order trigger', async () => {
    if (!isDbConnected) return;
    await asTenant((c) => c.query(`UPDATE public.orders SET status = 'cooking' WHERE id = $1`, [ORDER]));
    const r = await adminPool.query(
      `SELECT old_status, new_status FROM public.order_status_history WHERE order_id = $1 ORDER BY changed_at, new_status`,
      [ORDER]
    );
    expect(r.rows).toContainEqual({ old_status: 'pending', new_status: 'cooking' });
  });

  it('deleting an order as app_user still cascades into its history', async () => {
    if (!isDbConnected) return;
    const id = `hist-order-del-${randomUUID().slice(0, 8)}`;
    await adminPool.query(
      `INSERT INTO public.orders (id, restaurant_id, subtotal, delivery_fee, final_total) VALUES ($1, $2, 10, 0, 10)`,
      [id, RESTAURANT]
    );
    expect((await adminPool.query(`SELECT 1 FROM public.order_status_history WHERE order_id = $1`, [id])).rowCount).toBe(1);

    const del = await asTenant((c) => c.query(`DELETE FROM public.orders WHERE id = $1`, [id]));
    expect(del.rowCount).toBe(1);
    expect((await adminPool.query(`SELECT 1 FROM public.order_status_history WHERE order_id = $1`, [id])).rowCount).toBe(0);
  });
});
