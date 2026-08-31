import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';

const { Pool } = pg;

// Superuser connection (seeds tenants, cleans up — same role as the other
// Docker suite uses).
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/burger_page_test';

// app_user connection: no BYPASSRLS. This is the seam under test — raw SQL
// against Postgres as the role the future PgClient.ts adapter will use, with
// no application code in between.
const APP_USER_DATABASE_URL =
  process.env.APP_USER_DATABASE_URL || 'postgres://app_user:app_user_test_only@localhost:5432/burger_page_test';

let isDbConnected = false;

describe('RLS tenant isolation (write policies, app_user role)', () => {
  let adminPool: pg.Pool;
  let appPool: pg.Pool;
  const RESTAURANT_A = `rls-rest-a-${randomUUID().slice(0, 8)}`;
  const RESTAURANT_B = `rls-rest-b-${randomUUID().slice(0, 8)}`;
  const CUSTOMER_ID = `rls-cust-${randomUUID().slice(0, 8)}`;

  // Mirrors the SET LOCAL-only discipline PgClient.ts uses: a client checked
  // out for the duration of one call, GUCs set via SET LOCAL inside
  // BEGIN/COMMIT so nothing leaks across pooled connection reuse.
  async function asTenant<T>(
    restaurantId: string | null,
    actorRole: 'super_admin' | null,
    fn: (client: pg.PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await appPool.connect();
    try {
      await client.query('BEGIN');
      if (restaurantId !== null) {
        await client.query("SELECT set_config('app.restaurant_id', $1, true)", [restaurantId]);
      }
      if (actorRole !== null) {
        await client.query("SELECT set_config('app.actor_role', $1, true)", [actorRole]);
      }
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
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

      await adminPool.query(
        `INSERT INTO public.restaurants (id, slug, name, is_active)
         VALUES ($1, $1, 'RLS Test Restaurant A', true),
                ($2, $2, 'RLS Test Restaurant B', true)
         ON CONFLICT (id) DO UPDATE SET is_active = true`,
        [RESTAURANT_A, RESTAURANT_B]
      );
    } catch (err: any) {
      console.warn(
        `\n⚠️ [RLS Test] Skipping: cannot connect to ${DATABASE_URL} (${err.message}). Run via 'npm run test:integration:postgres' or start Docker.`
      );
      isDbConnected = false;
    }
  });

  afterAll(async () => {
    if (isDbConnected) {
      await adminPool.query(`DELETE FROM public.restaurants WHERE id IN ($1, $2)`, [RESTAURANT_A, RESTAURANT_B]);
    }
    await adminPool?.end();
    await appPool?.end();
  });

  it('app_user can insert and read its own tenant row', async () => {
    if (!isDbConnected) return;

    const inserted = await asTenant(RESTAURANT_A, null, (c) =>
      c.query(
        `INSERT INTO public.customers (id, restaurant_id, name, phone) VALUES ($1, $2, 'RLS Test', '3000000000') RETURNING id`,
        [CUSTOMER_ID, RESTAURANT_A]
      )
    );
    expect(inserted.rowCount).toBe(1);

    const read = await asTenant(RESTAURANT_A, null, (c) =>
      c.query(`SELECT id, restaurant_id FROM public.customers WHERE id = $1`, [CUSTOMER_ID])
    );
    expect(read.rowCount).toBe(1);
    expect(read.rows[0].restaurant_id).toBe(RESTAURANT_A);
  });

  it('app_user under a different tenant context cannot read the row', async () => {
    if (!isDbConnected) return;
    const read = await asTenant(RESTAURANT_B, null, (c) =>
      c.query(`SELECT id FROM public.customers WHERE id = $1`, [CUSTOMER_ID])
    );
    expect(read.rowCount).toBe(0);
  });

  it('app_user under a different tenant context cannot write a row claiming another restaurant_id', async () => {
    if (!isDbConnected) return;
    await expect(
      asTenant(RESTAURANT_B, null, (c) =>
        c.query(
          `INSERT INTO public.customers (id, restaurant_id, name, phone) VALUES ($1, $2, 'Hijack', '3009999999')`,
          [`${CUSTOMER_ID}-hijack`, RESTAURANT_A]
        )
      )
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('app_user with no tenant context at all sees nothing (deny by default)', async () => {
    if (!isDbConnected) return;
    const read = await asTenant(null, null, (c) =>
      c.query(`SELECT id FROM public.customers WHERE id = $1`, [CUSTOMER_ID])
    );
    expect(read.rowCount).toBe(0);
  });

  it('app_user with actor_role=super_admin bypasses tenant scoping', async () => {
    if (!isDbConnected) return;
    const read = await asTenant(RESTAURANT_B, 'super_admin', (c) =>
      c.query(`SELECT id FROM public.customers WHERE id = $1`, [CUSTOMER_ID])
    );
    expect(read.rowCount).toBe(1);
  });
});
