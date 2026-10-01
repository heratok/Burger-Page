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
    fn: (client: pg.PoolClient) => Promise<T>,
    restaurantSlug: string | null = null
  ): Promise<T> {
    const client = await appPool.connect();
    try {
      await client.query('BEGIN');
      if (restaurantSlug !== null) {
        await client.query("SELECT set_config('app.restaurant_slug', $1, true)", [restaurantSlug]);
      }
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

  describe('users RLS — tenant isolation & platform protection (JD-CONF-01)', () => {
    const PLATFORM_USER = `platform-${randomUUID().slice(0, 8)}`;
    const TENANT_A_USER = `tenant-a-${randomUUID().slice(0, 8)}`;
    const TENANT_B_USER = `tenant-b-${randomUUID().slice(0, 8)}`;

    beforeAll(async () => {
      if (!isDbConnected) return;
      await adminPool.query(
        `INSERT INTO public.users (id, username, password_hash, role, restaurant_id)
         VALUES ($1, $1, 'hash-platform', 'super_admin', NULL),
                ($2, $2, 'hash-a', 'restaurant_admin', $3),
                ($4, $4, 'hash-b', 'restaurant_admin', $5)`,
        [PLATFORM_USER, TENANT_A_USER, RESTAURANT_A, TENANT_B_USER, RESTAURANT_B]
      );
    });

    afterAll(async () => {
      if (isDbConnected) {
        await adminPool.query(`DELETE FROM public.users WHERE id IN ($1, $2, $3)`, [
          PLATFORM_USER,
          TENANT_A_USER,
          TENANT_B_USER,
        ]);
      }
    });

    it('tenant context reads only its own users, never other tenants or platform rows', async () => {
      if (!isDbConnected) return;
      const read = await asTenant(RESTAURANT_A, null, (c) =>
        c.query(
          `SELECT id, username, password_hash FROM public.users WHERE username IN ($1, $2, $3)`,
          [TENANT_A_USER, TENANT_B_USER, PLATFORM_USER]
        )
      );
      const usernames = read.rows.map((r) => r.username);
      expect(usernames).toContain(TENANT_A_USER);
      expect(usernames).not.toContain(TENANT_B_USER);
      expect(usernames).not.toContain(PLATFORM_USER);
    });

    it('no-context app_user session reads ZERO users rows directly (JD-CRIT-03 closed)', async () => {
      if (!isDbConnected) return;
      // Direct full-table read with neither app.restaurant_id nor app.actor_role
      // set. The old users_select_for_auth third OR branch (both GUCs NULL ->
      // USING (TRUE)) returned every row incl. password_hash; it is removed, so
      // every row must be filtered out for a no-context session.
      const read = await asTenant(null, null, (c) =>
        c.query(`SELECT id, username, password_hash FROM public.users`)
      );
      expect(read.rowCount).toBe(0);
    });

    it('login bootstrap resolves exactly the single matching user via look_up_user_for_auth, nothing else', async () => {
      if (!isDbConnected) return;
      // The narrow SECURITY DEFINER escape hatch is the ONLY no-context way to
      // read a user: exact match on the login credential, at most one row, with
      // every column the authenticator needs (password_hash for verification).
      // C2: the path is gated on app.auth_bootstrap='true' (what the
      // PgUserRepository login bootstrap sets via SET LOCAL before looking up).
      const bootstrap = async (c: pg.PoolClient, q: string, p: unknown[]) => {
        await c.query("SELECT set_config('app.auth_bootstrap', 'true', true)");
        return c.query(q, p);
      };

      const byUsername = await asTenant(null, null, (c) =>
        bootstrap(c, `SELECT id, username, role, restaurant_id, is_active, password_hash FROM public.look_up_user_for_auth($1)`, [PLATFORM_USER])
      );
      expect(byUsername.rowCount).toBe(1);
      expect(byUsername.rows[0]).toMatchObject({
        username: PLATFORM_USER,
        role: 'super_admin',
        restaurant_id: null,
        is_active: true,
        password_hash: 'hash-platform',
      });

      // By-id variant (PgUserRepository.findById before tenant resolution).
      const byId = await asTenant(null, null, (c) =>
        bootstrap(c, `SELECT id FROM public.look_up_user_for_auth_by_id($1)`, [PLATFORM_USER])
      );
      expect(byId.rowCount).toBe(1);
      expect(byId.rows[0].id).toBe(PLATFORM_USER);

      // Exact-match only: a lookup for a non-existent credential returns nothing.
      const missing = await asTenant(null, null, (c) =>
        bootstrap(c, `SELECT id FROM public.look_up_user_for_auth($1)`, [`no-such-${randomUUID().slice(0, 8)}`])
      );
      expect(missing.rowCount).toBe(0);
    });

    it('look_up_user_for_auth WITHOUT app.auth_bootstrap fails closed with 42501 (C2)', async () => {
      if (!isDbConnected) return;
      await expect(
        asTenant(null, null, (c) =>
          c.query(`SELECT id, username, password_hash FROM public.look_up_user_for_auth($1)`, [PLATFORM_USER])
        )
      ).rejects.toMatchObject({ code: '42501' });
      await expect(
        asTenant(null, null, (c) =>
          c.query(`SELECT id FROM public.look_up_user_for_auth_by_id($1)`, [PLATFORM_USER])
        )
      ).rejects.toMatchObject({ code: '42501' });
    });

    it('super_admin context sees all users', async () => {
      if (!isDbConnected) return;
      const read = await asTenant(RESTAURANT_A, 'super_admin', (c) =>
        c.query(`SELECT username FROM public.users WHERE username IN ($1, $2, $3)`, [
          TENANT_A_USER,
          TENANT_B_USER,
          PLATFORM_USER,
        ])
      );
      expect(read.rows).toHaveLength(3);
    });

    it('tenant cannot overwrite a platform super_admin password_hash', async () => {
      if (!isDbConnected) return;
      // Platform rows are invisible to tenant sessions (users_select_for_auth
      // reserves restaurant_id IS NULL rows for super_admin), so an UPDATE
      // attempt is a silent 0-row no-op rather than an explicit 42501.
      // Fail-loud semantics here would require revealing platform rows to
      // tenant reads (an UPDATE's row visibility is governed by the SELECT
      // policies), leaking their existence — the enforced contract is
      // immutability, which we assert directly.
      const attempt = await asTenant(RESTAURANT_A, null, (c) =>
        c.query(`UPDATE public.users SET password_hash = 'pwned' WHERE id = $1`, [PLATFORM_USER])
      );
      expect(attempt.rowCount).toBe(0);
      const { rows } = await adminPool.query(`SELECT password_hash FROM public.users WHERE id = $1`, [PLATFORM_USER]);
      expect(rows[0].password_hash).toBe('hash-platform');
    });

    it('tenant cannot self-promote to super_admin', async () => {
      if (!isDbConnected) return;
      await expect(
        asTenant(RESTAURANT_A, null, (c) =>
          c.query(`UPDATE public.users SET role = 'super_admin' WHERE id = $1`, [TENANT_A_USER])
        )
      ).rejects.toMatchObject({ code: '42501' });
    });

    it('tenant cannot insert a platform-level super_admin account', async () => {
      if (!isDbConnected) return;
      await expect(
        asTenant(RESTAURANT_A, null, (c) =>
          c.query(
            `INSERT INTO public.users (id, username, password_hash, role, restaurant_id)
             VALUES ($1, 'fake-platform', 'x', 'super_admin', NULL)`,
            [`fake-${randomUUID().slice(0, 8)}`]
          )
        )
      ).rejects.toMatchObject({ code: '42501' });
    });

    it('tenant can update password_hash of its own staff (role unchanged)', async () => {
      if (!isDbConnected) return;
      const updated = await asTenant(RESTAURANT_A, null, (c) =>
        c.query(`UPDATE public.users SET password_hash = 'hash-a-2' WHERE id = $1 RETURNING role`, [TENANT_A_USER])
      );
      expect(updated.rowCount).toBe(1);
      expect(updated.rows[0].role).toBe('restaurant_admin');
    });
  });

  describe('SECURITY DEFINER GUC guards (C1/C2/M1 hardening)', () => {
    const ORDER_ID = `rls-order-${randomUUID().slice(0, 8)}`;
    const ORDER_ID_B = `rls-order-b-${randomUUID().slice(0, 8)}`;
    const INVENTORY_ID = `rls-inv-${randomUUID().slice(0, 8)}`;
    const ACTOR_ID = `rls-actor-${randomUUID().slice(0, 8)}`;

    beforeAll(async () => {
      if (!isDbConnected) return;
      await adminPool.query(
        `INSERT INTO public.orders (id, restaurant_id, status, subtotal, delivery_fee, final_total, payment_method)
         VALUES ($1, $2, 'cooking', 0, 0, 0, 'Efectivo')
         ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
        [ORDER_ID, RESTAURANT_A]
      );
      await adminPool.query(
        `INSERT INTO public.orders (id, restaurant_id, status, subtotal, delivery_fee, final_total, payment_method, client_order_id)
         VALUES ($1, $2, 'pending', 0, 0, 0, 'Efectivo', 'rls-replay-ok')
         ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, client_order_id = EXCLUDED.client_order_id`,
        [ORDER_ID_B, RESTAURANT_B]
      );
      await adminPool.query(
        `INSERT INTO public.inventory_items (id, restaurant_id, name, current_stock, unit, min_stock_alert, cost_per_unit)
         VALUES ($1, $2, 'RLS Hardening Stock', 10, 'kg', 1, 1000)
         ON CONFLICT (id, restaurant_id) DO UPDATE SET current_stock = EXCLUDED.current_stock`,
        [INVENTORY_ID, RESTAURANT_A]
      );
      await adminPool.query(
        `INSERT INTO public.users (id, username, password_hash, role, restaurant_id)
         VALUES ($1, $1, 'hash-rls-actor', 'restaurant_admin', $2)
         ON CONFLICT (id) DO UPDATE SET restaurant_id = EXCLUDED.restaurant_id`,
        [ACTOR_ID, RESTAURANT_A]
      );
    });

    afterAll(async () => {
      if (isDbConnected) {
        await adminPool.query(`DELETE FROM public.orders WHERE id IN ($1, $2)`, [ORDER_ID, ORDER_ID_B]);
        await adminPool.query(`DELETE FROM public.inventory_items WHERE id = $1`, [INVENTORY_ID]);
        await adminPool.query(`DELETE FROM public.users WHERE id = $1`, [ACTOR_ID]);
      }
    });

    it('create_order_atomic: GUC tenant A + p_restaurant_id tenant B → 42501 (C1)', async () => {
      if (!isDbConnected) return;
      // The tenant-context guard fires before any validation/data access, so
      // minimal args suffice — the call must fail closed with 42501 before
      // touching rows.
      await expect(
        asTenant(RESTAURANT_A, null, (c) =>
          c.query(
            `SELECT public.create_order_atomic($1, $2, NULL, 'Efectivo', 100, 0, NULL, '[]'::jsonb, NULL, NULL)`,
            [`rls-order-forbidden-${randomUUID().slice(0, 8)}`, RESTAURANT_B]
          )
        )
      ).rejects.toMatchObject({ code: '42501' });
    });

    it('create_order_atomic: matching GUC still succeeds (storefront path preserved)', async () => {
      if (!isDbConnected) return;
      // Positive control: the app_user session sets app.restaurant_id to the
      // SAME restaurant it passes, so the guard must NOT block the legitimate
      // backend/storefront path. Exercises the idempotent replay against the
      // pre-seeded order in restaurant B (client_order_id = 'rls-replay-ok').
      const result = await asTenant(RESTAURANT_B, null, (c) =>
        c.query(
          `SELECT public.create_order_atomic($1, $2, NULL, 'Efectivo', 0, 0, NULL, '[]'::jsonb, NULL, 'rls-replay-ok') AS out`,
          [ORDER_ID_B, RESTAURANT_B]
        )
      );
      // The idempotency replay finds the pre-seeded order in restaurant B and
      // returns its lean projection — proving the GUC==arg path is NOT blocked.
      expect(result.rows[0].out).toMatchObject({ id: ORDER_ID_B, status: 'pending', restaurant_id: RESTAURANT_B });
    });

    it('adjust_inventory_stock: GUC tenant A + p_restaurant_id tenant B → 42501 (C1)', async () => {
      if (!isDbConnected) return;
      await expect(
        asTenant(RESTAURANT_A, null, (c) =>
          c.query(`SELECT * FROM public.adjust_inventory_stock($1, $2, $3)`, [INVENTORY_ID, RESTAURANT_B, 5])
        )
      ).rejects.toMatchObject({ code: '42501' });
    });

    it('adjust_inventory_stock: non-finite delta is rejected', async () => {
      if (!isDbConnected) return;
      await expect(
        asTenant(RESTAURANT_A, null, (c) =>
          c.query(`SELECT * FROM public.adjust_inventory_stock($1, $2, $3::numeric)`, [INVENTORY_ID, RESTAURANT_A, 'Infinity'])
        )
      ).rejects.toThrow(/Invalid quantity change/);
    });

    it('update_order_status_with_actor: p_actor = NULL is rejected with 42501 (C2)', async () => {
      if (!isDbConnected) return;
      await expect(
        asTenant(RESTAURANT_A, null, (c) =>
          c.query(`SELECT public.update_order_status_with_actor($1, 'delivered', $2, NULL)`, [ORDER_ID, RESTAURANT_A])
        )
      ).rejects.toMatchObject({ code: '42501' });
    });

    it('update_order_status_with_actor: GUC tenant A + p_restaurant_id tenant B → 42501 (C1)', async () => {
      if (!isDbConnected) return;
      await expect(
        asTenant(RESTAURANT_A, null, (c) =>
          c.query(`SELECT public.update_order_status_with_actor($1, 'delivered', $2, $3)`, [ORDER_ID, RESTAURANT_B, ACTOR_ID])
        )
      ).rejects.toMatchObject({ code: '42501' });
    });

    it('update_order_status_with_actor: status CAS rejects a stale snapshot with P0001 (M1)', async () => {
      if (!isDbConnected) return;
      // The seeded order in restaurant A is 'cooking'; asking to move it with
      // expectedStatus='pending' (stale) must raise the concurrency error
      // instead of regressing/skipping.
      await expect(
        asTenant(RESTAURANT_A, null, (c) =>
          c.query(`SELECT public.update_order_status_with_actor($1, 'delivered', $2, $3, 'pending')`, [ORDER_ID, RESTAURANT_A, ACTOR_ID])
        )
      ).rejects.toMatchObject({ code: 'P0001', message: expect.stringContaining('concurrently') });
      // Verify the row is untouched.
      const { rows } = await adminPool.query(`SELECT status FROM public.orders WHERE id = $1`, [ORDER_ID]);
      expect(rows[0].status).toBe('cooking');
    });

    it('update_order_status_with_actor: matching snapshot CAS succeeds', async () => {
      if (!isDbConnected) return;
      const updated = await asTenant(RESTAURANT_A, null, (c) =>
        c.query(`SELECT public.update_order_status_with_actor($1, 'delivered', $2, $3, 'cooking') AS updated`, [ORDER_ID, RESTAURANT_A, ACTOR_ID])
      );
      expect(updated.rows[0].updated).toBe(true);
      const { rows } = await adminPool.query(`SELECT status FROM public.orders WHERE id = $1`, [ORDER_ID]);
      expect(rows[0].status).toBe('delivered');
    });
  });

  describe('RLS helper functions (db-hardening-0008 T3)', () => {
    it('app_current_restaurant_id() / app_is_super_admin() mirror the session GUCs', async () => {
      if (!isDbConnected) return;
      const none = await asTenant(null, null, (c) =>
        c.query('SELECT public.app_current_restaurant_id() AS rid, public.app_is_super_admin() AS sa')
      );
      expect(none.rows[0]).toEqual({ rid: null, sa: false });

      const tenant = await asTenant(RESTAURANT_A, null, (c) =>
        c.query('SELECT public.app_current_restaurant_id() AS rid, public.app_is_super_admin() AS sa')
      );
      expect(tenant.rows[0]).toEqual({ rid: RESTAURANT_A, sa: false });

      const admin = await asTenant(null, 'super_admin', (c) =>
        c.query('SELECT public.app_current_restaurant_id() AS rid, public.app_is_super_admin() AS sa')
      );
      expect(admin.rows[0]).toEqual({ rid: null, sa: true });
    });

    it('helpers are STABLE (InitPlan-cacheable)', async () => {
      if (!isDbConnected) return;
      const { rows } = await adminPool.query(
        `SELECT proname, provolatile FROM pg_proc
         WHERE pronamespace = 'public'::regnamespace
           AND proname IN ('app_current_restaurant_id', 'app_is_super_admin')`
      );
      expect(rows).toHaveLength(2);
      for (const r of rows) expect(r.provolatile).toBe('s');
    });

    it('every tenant_isolation_* policy goes through the helpers instead of raw current_setting', async () => {
      if (!isDbConnected) return;
      const { rows } = await adminPool.query(
        `SELECT policyname, COALESCE(qual, '') || ' ' || COALESCE(with_check, '') AS expr
         FROM pg_policies
         WHERE schemaname = 'public' AND policyname LIKE 'tenant_isolation_%'`
      );
      expect(rows.length).toBeGreaterThan(20);
      for (const r of rows) {
        expect(r.expr, r.policyname).not.toContain('current_setting');
        expect(r.expr, r.policyname).toMatch(/app_current_restaurant_id|app_is_super_admin/);
      }
    });
  });

  describe('public reads are slug-scoped (db-hardening-0008 T4)', () => {
    const INACTIVE = `rls-rest-off-${randomUUID().slice(0, 8)}`;
    const PROD_A = `rls-prod-a-${randomUUID().slice(0, 8)}`;
    const PROD_B = `rls-prod-b-${randomUUID().slice(0, 8)}`;
    const ADD_A = `rls-add-a-${randomUUID().slice(0, 8)}`;
    const CAT_A = `rls-cat-a-${randomUUID().slice(0, 8)}`;
    const CAT_A_OFF = `rls-cat-a-off-${randomUUID().slice(0, 8)}`;
    const CAT_B = `rls-cat-b-${randomUUID().slice(0, 8)}`;

    beforeAll(async () => {
      if (!isDbConnected) return;
      await adminPool.query(
        `INSERT INTO public.restaurants (id, slug, name, is_active) VALUES ($1, $1, 'RLS Inactive', false)
         ON CONFLICT (id) DO UPDATE SET is_active = false`,
        [INACTIVE]
      );
      for (const id of [RESTAURANT_A, RESTAURANT_B, INACTIVE]) {
        await adminPool.query(`INSERT INTO public.restaurant_settings (restaurant_id) VALUES ($1) ON CONFLICT DO NOTHING`, [id]);
        await adminPool.query(`INSERT INTO public.restaurant_branding (restaurant_id) VALUES ($1) ON CONFLICT DO NOTHING`, [id]);
      }
      await adminPool.query(
        `INSERT INTO public.categories (id, restaurant_id, name, is_active) VALUES
           ($1, $4, 'Cat A', true), ($2, $4, 'Cat A off', false), ($3, $5, 'Cat B', true)`,
        [CAT_A, CAT_A_OFF, CAT_B, RESTAURANT_A, RESTAURANT_B]
      );
      await adminPool.query(
        `INSERT INTO public.products (id, restaurant_id, name, price, is_available) VALUES
           ($1, $3, 'Prod A', 10, true), ($2, $4, 'Prod B', 10, true)`,
        [PROD_A, PROD_B, RESTAURANT_A, RESTAURANT_B]
      );
      await adminPool.query(
        `INSERT INTO public.product_additions (id, restaurant_id, name, price, is_available) VALUES ($1, $2, 'Add A', 1, true)`,
        [ADD_A, RESTAURANT_A]
      );
    });

    afterAll(async () => {
      if (isDbConnected) {
        await adminPool.query(`DELETE FROM public.restaurants WHERE id = $1`, [INACTIVE]);
      }
    });

    const ids = (r: pg.QueryResult) => r.rows.map((x) => x.id ?? x.restaurant_id).sort();

    it('an anonymous session (no tenant, no slug) cannot list restaurants', async () => {
      if (!isDbConnected) return;
      const r = await asTenant(null, null, (c) => c.query(`SELECT id FROM public.restaurants`));
      expect(r.rowCount).toBe(0);
    });

    it('an anonymous session cannot read products, additions, categories, settings or branding of any tenant', async () => {
      if (!isDbConnected) return;
      await asTenant(null, null, async (c) => {
        for (const table of ['products', 'product_additions', 'categories', 'restaurant_settings', 'restaurant_branding']) {
          const r = await c.query(`SELECT 1 FROM public.${table}`);
          expect(r.rowCount, table).toBe(0);
        }
      });
    });

    it('a declared slug without tenant context exposes only that active restaurant, its settings, branding and active categories', async () => {
      if (!isDbConnected) return;
      await asTenant(
        null,
        null,
        async (c) => {
          expect(ids(await c.query(`SELECT id FROM public.restaurants`))).toEqual([RESTAURANT_A]);
          expect(ids(await c.query(`SELECT restaurant_id FROM public.restaurant_settings`))).toEqual([RESTAURANT_A]);
          expect(ids(await c.query(`SELECT restaurant_id FROM public.restaurant_branding`))).toEqual([RESTAURANT_A]);
          expect(ids(await c.query(`SELECT id FROM public.categories`))).toEqual([CAT_A]);
          // products/additions stay private to their tenant context
          expect((await c.query(`SELECT 1 FROM public.products`)).rowCount).toBe(0);
          expect((await c.query(`SELECT 1 FROM public.product_additions`)).rowCount).toBe(0);
        },
        RESTAURANT_A
      );
    });

    it('a declared slug of an inactive restaurant exposes nothing', async () => {
      if (!isDbConnected) return;
      await asTenant(
        null,
        null,
        async (c) => {
          expect((await c.query(`SELECT 1 FROM public.restaurants`)).rowCount).toBe(0);
          expect((await c.query(`SELECT 1 FROM public.restaurant_settings`)).rowCount).toBe(0);
          expect((await c.query(`SELECT 1 FROM public.restaurant_branding`)).rowCount).toBe(0);
        },
        INACTIVE
      );
    });

    it('the slug declaration is ignored once a tenant context exists', async () => {
      if (!isDbConnected) return;
      await asTenant(
        RESTAURANT_B,
        null,
        async (c) => {
          expect(ids(await c.query(`SELECT id FROM public.restaurants`))).toEqual([RESTAURANT_B]);
        },
        RESTAURANT_A
      );
    });

    it('tenant A cannot read tenant B products, additions, categories or settings', async () => {
      if (!isDbConnected) return;
      await asTenant(RESTAURANT_A, null, async (c) => {
        expect(ids(await c.query(`SELECT id FROM public.products WHERE id IN ($1, $2)`, [PROD_A, PROD_B]))).toEqual([PROD_A]);
        expect(ids(await c.query(`SELECT id FROM public.categories WHERE id IN ($1, $2)`, [CAT_A, CAT_B]))).toEqual([CAT_A]);
        expect(
          ids(await c.query(`SELECT restaurant_id FROM public.restaurant_settings WHERE restaurant_id IN ($1, $2)`, [RESTAURANT_A, RESTAURANT_B]))
        ).toEqual([RESTAURANT_A]);
        expect((await c.query(`SELECT 1 FROM public.restaurants WHERE id = $1`, [RESTAURANT_B])).rowCount).toBe(0);
      });
    });

    it('unavailable products stay readable by their own tenant (admin catalog)', async () => {
      if (!isDbConnected) return;
      await adminPool.query(`UPDATE public.products SET is_available = false WHERE id = $1`, [PROD_A]);
      try {
        const r = await asTenant(RESTAURANT_A, null, (c) => c.query(`SELECT id FROM public.products WHERE id = $1`, [PROD_A]));
        expect(r.rowCount).toBe(1);
      } finally {
        await adminPool.query(`UPDATE public.products SET is_available = true WHERE id = $1`, [PROD_A]);
      }
    });
  });
  describe('restaurant_opening_hours (store-opening-hours T2)', () => {
    const OFF = `rls-oh-off-${randomUUID().slice(0, 8)}`;
    const row = (suffix: string) => `oh_rls_${suffix}_${randomUUID().slice(0, 8)}`;
    const seeded: Record<string, string> = {};

    beforeAll(async () => {
      if (!isDbConnected) return;
      await adminPool.query(
        `INSERT INTO public.restaurants (id, slug, name, is_active) VALUES ($1, $1, 'RLS Hours Inactive', false)
         ON CONFLICT (id) DO UPDATE SET is_active = false`,
        [OFF]
      );
      for (const [key, restaurantId] of [['a', RESTAURANT_A], ['b', RESTAURANT_B], ['off', OFF]] as const) {
        seeded[key] = row(key);
        await adminPool.query(
          `INSERT INTO public.restaurant_opening_hours (id, restaurant_id, day_of_week, open_time, close_time)
           VALUES ($1, $2, 1, '12:00', '22:30')`,
          [seeded[key], restaurantId]
        );
      }
    });

    afterAll(async () => {
      if (isDbConnected) await adminPool.query(`DELETE FROM public.restaurants WHERE id = $1`, [OFF]);
    });

    const hourIds = async (c: pg.PoolClient) =>
      (await c.query(`SELECT id FROM public.restaurant_opening_hours WHERE id = ANY($1)`, [Object.values(seeded)])).rows
        .map((r) => r.id)
        .sort();

    it('an anonymous session (no tenant, no slug) reads nothing', async () => {
      if (!isDbConnected) return;
      expect(await asTenant(null, null, hourIds)).toEqual([]);
    });

    it('a declared slug exposes only the active restaurant with that slug', async () => {
      if (!isDbConnected) return;
      expect(await asTenant(null, null, hourIds, RESTAURANT_A)).toEqual([seeded.a]);
      expect(await asTenant(null, null, hourIds, OFF)).toEqual([]);
    });

    it('a declared slug never allows writes', async () => {
      if (!isDbConnected) return;
      await expect(
        asTenant(
          null,
          null,
          (c) =>
            c.query(
              `INSERT INTO public.restaurant_opening_hours (id, restaurant_id, day_of_week, open_time, close_time)
               VALUES ($1, $2, 2, '10:00', '11:00')`,
              [row('anon'), RESTAURANT_A]
            ),
          RESTAURANT_A
        )
      ).rejects.toMatchObject({ code: '42501' });
    });

    it('a tenant only sees its own rows, whatever slug was declared', async () => {
      if (!isDbConnected) return;
      expect(await asTenant(RESTAURANT_A, null, hourIds)).toEqual([seeded.a]);
      expect(await asTenant(RESTAURANT_B, null, hourIds, RESTAURANT_A)).toEqual([seeded.b]);
    });

    it('a tenant can replace its own schedule but not write into another tenant', async () => {
      if (!isDbConnected) return;
      const mine = row('mine');
      await asTenant(RESTAURANT_A, null, async (c) => {
        await c.query(
          `INSERT INTO public.restaurant_opening_hours (id, restaurant_id, day_of_week, open_time, close_time)
           VALUES ($1, $2, 2, '10:00', '11:00')`,
          [mine, RESTAURANT_A]
        );
        await c.query(`UPDATE public.restaurant_opening_hours SET close_time = '12:00' WHERE id = $1`, [mine]);
        await c.query(`DELETE FROM public.restaurant_opening_hours WHERE id = $1`, [mine]);
      });

      await expect(
        asTenant(RESTAURANT_A, null, (c) =>
          c.query(
            `INSERT INTO public.restaurant_opening_hours (id, restaurant_id, day_of_week, open_time, close_time)
             VALUES ($1, $2, 3, '10:00', '11:00')`,
            [row('cross'), RESTAURANT_B]
          )
        )
      ).rejects.toMatchObject({ code: '42501' });

      const touched = await asTenant(RESTAURANT_A, null, async (c) => ({
        updated: (await c.query(`UPDATE public.restaurant_opening_hours SET close_time = '23:00' WHERE id = $1`, [seeded.b])).rowCount,
        deleted: (await c.query(`DELETE FROM public.restaurant_opening_hours WHERE id = $1`, [seeded.b])).rowCount,
      }));
      expect(touched).toEqual({ updated: 0, deleted: 0 });
    });

    it('a super admin reads every tenant', async () => {
      if (!isDbConnected) return;
      expect(await asTenant(null, 'super_admin', hourIds)).toEqual([seeded.a, seeded.b, seeded.off].sort());
    });

    it('rejects a weekday outside 0-6, a malformed id and a duplicated range', async () => {
      if (!isDbConnected) return;
      const insert = (id: string, day: number) =>
        adminPool.query(
          `INSERT INTO public.restaurant_opening_hours (id, restaurant_id, day_of_week, open_time, close_time)
           VALUES ($1, $2, $3, '12:00', '22:30')`,
          [id, RESTAURANT_A, day]
        );
      await expect(insert(row('d7'), 7)).rejects.toMatchObject({ code: '23514' });
      await expect(insert(row('dneg'), -1)).rejects.toMatchObject({ code: '23514' });
      await expect(insert('bad id', 2)).rejects.toMatchObject({ code: '23514', constraint: 'chk_restaurant_opening_hours_id_format' });
      await expect(insert(row('dup'), 1)).rejects.toMatchObject({ code: '23505', constraint: 'uq_restaurant_opening_hours_range' });
    });

    it('deleting the restaurant removes its schedule (config, not financial history)', async () => {
      if (!isDbConnected) return;
      const id = `rls-oh-del-${randomUUID().slice(0, 8)}`;
      await adminPool.query(`INSERT INTO public.restaurants (id, slug, name) VALUES ($1, $1, 'Gone')`, [id]);
      await adminPool.query(
        `INSERT INTO public.restaurant_opening_hours (id, restaurant_id, day_of_week, open_time, close_time)
         VALUES ($1, $2, 0, '08:00', '09:00')`,
        [row('del'), id]
      );
      await adminPool.query(`DELETE FROM public.restaurants WHERE id = $1`, [id]);
      const { rowCount } = await adminPool.query(`SELECT 1 FROM public.restaurant_opening_hours WHERE restaurant_id = $1`, [id]);
      expect(rowCount).toBe(0);
    });

    it('new restaurants fall back to the Bogota timezone and unpaused orders', async () => {
      if (!isDbConnected) return;
      await adminPool.query(`INSERT INTO public.restaurant_settings (restaurant_id) VALUES ($1) ON CONFLICT DO NOTHING`, [RESTAURANT_A]);
      const { rows } = await adminPool.query(
        `SELECT timezone, orders_paused FROM public.restaurant_settings WHERE restaurant_id = $1`,
        [RESTAURANT_A]
      );
      expect(rows[0]).toEqual({ timezone: 'America/Bogota', orders_paused: false });
    });
  });

});
