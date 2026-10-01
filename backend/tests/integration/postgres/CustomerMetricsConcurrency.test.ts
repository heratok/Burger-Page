import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/burger_page_test';
const APP_USER_DATABASE_URL =
  process.env.APP_USER_DATABASE_URL || 'postgres://app_user:app_user_test_only@localhost:5432/burger_page_test';

let isDbConnected = false;

describe('update_customer_order_metrics under concurrent orders (db-hardening-0008 T2)', () => {
  let adminPool: pg.Pool;
  let appPool: pg.Pool;
  const RESTAURANT = `cm-rest-${randomUUID().slice(0, 8)}`;
  const CUSTOMER = `cm-cust-${randomUUID().slice(0, 8)}`;

  async function openTenantTx(): Promise<pg.PoolClient> {
    const client = await appPool.connect();
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.restaurant_id', $1, true)", [RESTAURANT]);
    return client;
  }

  const insertOrder = (client: pg.PoolClient, id: string) =>
    client.query(
      `INSERT INTO public.orders (id, restaurant_id, customer_id, subtotal, delivery_fee, final_total)
       VALUES ($1, $2, $3, 100, 0, 100)`,
      [id, RESTAURANT, CUSTOMER]
    );

  beforeAll(async () => {
    adminPool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2000 });
    appPool = new Pool({ connectionString: APP_USER_DATABASE_URL, connectionTimeoutMillis: 2000 });
    try {
      await adminPool.query('SELECT 1');
      isDbConnected = true;
      await adminPool.query(`INSERT INTO public.restaurants (id, slug, name, is_active) VALUES ($1, $1, 'CM Test', true)`, [
        RESTAURANT,
      ]);
      await adminPool.query(`INSERT INTO public.customers (id, restaurant_id, name, phone) VALUES ($1, $2, 'CM', '3001112222')`, [
        CUSTOMER,
        RESTAURANT,
      ]);
    } catch (err: any) {
      console.warn(`\n[CustomerMetricsConcurrency] Skipping: cannot connect to ${DATABASE_URL} (${err.message}).`);
      isDbConnected = false;
    }
  });

  afterAll(async () => {
    if (isDbConnected) {
      // Orders first: restaurant FKs on sales tables are ON DELETE RESTRICT.
      await adminPool.query(`DELETE FROM public.orders WHERE restaurant_id = $1`, [RESTAURANT]);
      await adminPool.query(`DELETE FROM public.restaurants WHERE id = $1`, [RESTAURANT]);
    }
    await adminPool?.end();
    await appPool?.end();
  });

  it('does not lose an update when a cancellation and a new order hit the same customer concurrently', async () => {
    if (!isDbConnected) return;

    const firstOrder = `cm-order-${randomUUID().slice(0, 8)}`;
    await adminPool.query(
      `INSERT INTO public.orders (id, restaurant_id, customer_id, subtotal, delivery_fee, final_total)
       VALUES ($1, $2, $3, 100, 0, 100)`,
      [firstOrder, RESTAURANT, CUSTOMER]
    );

    const tx1 = await openTenantTx();
    const tx2 = await openTenantTx();
    try {
      // tx1 cancels the first order: the customer drops to 0 orders (uncommitted).
      await tx1.query(`UPDATE public.orders SET status = 'cancelled' WHERE id = $1`, [firstOrder]);

      // tx2 inserts a second order. Without a row lock on the customer it would
      // aggregate a snapshot that still counts the first order (2 orders) and
      // overwrite tx1's result once tx1 commits. Started without awaiting so
      // tx1 can commit while tx2 is blocked.
      const second = insertOrder(tx2, `cm-order-${randomUUID().slice(0, 8)}`);
      await new Promise((r) => setTimeout(r, 300));
      await tx1.query('COMMIT');
      await second;
      await tx2.query('COMMIT');
    } finally {
      tx1.release();
      tx2.release();
    }

    const { rows } = await adminPool.query(
      `SELECT total_orders, total_spent FROM public.customers WHERE id = $1`,
      [CUSTOMER]
    );
    expect(rows[0].total_orders).toBe(1);
    expect(Number(rows[0].total_spent)).toBe(100);
  });
});
