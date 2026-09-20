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
      const byUsername = await asTenant(null, null, (c) =>
        c.query(
          `SELECT id, username, role, restaurant_id, is_active, password_hash
           FROM public.look_up_user_for_auth($1)`,
          [PLATFORM_USER]
        )
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
        c.query(`SELECT id FROM public.look_up_user_for_auth_by_id($1)`, [PLATFORM_USER])
      );
      expect(byId.rowCount).toBe(1);
      expect(byId.rows[0].id).toBe(PLATFORM_USER);

      // Exact-match only: a lookup for a non-existent credential returns nothing.
      const missing = await asTenant(null, null, (c) =>
        c.query(`SELECT id FROM public.look_up_user_for_auth($1)`, [`no-such-${randomUUID().slice(0, 8)}`])
      );
      expect(missing.rowCount).toBe(0);
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
});
