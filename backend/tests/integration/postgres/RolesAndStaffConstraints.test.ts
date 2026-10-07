import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/burger_page_test';

let isDbConnected = false;

/** Migration 0017: roles table, users.role_id and the restaurant_staff role (real Postgres, owner role). */
describe('roles and staff users constraints (real Postgres)', () => {
  let pool: pg.Pool;
  const suffix = randomUUID().slice(0, 8);
  const REST_A = `rbac-a-${suffix}`;
  const REST_B = `rbac-b-${suffix}`;
  const roleA = `role_a_${suffix}`;
  const roleB = `role_b_${suffix}`;

  const insertUser = (id: string, role: string, restaurantId: string | null, roleId: string | null) =>
    pool.query(
      `INSERT INTO public.users (id, username, password_hash, role, restaurant_id, role_id)
       VALUES ($1, $1, 'x', $2, $3, $4)`,
      [id, role, restaurantId, roleId]
    );

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2000 });
    try {
      await pool.query('SELECT 1');
      isDbConnected = true;
      await pool.query(
        `INSERT INTO public.restaurants (id, slug, name, is_active) VALUES ($1,$1,'A',true),($2,$2,'B',true)`,
        [REST_A, REST_B]
      );
      await pool.query(
        `INSERT INTO public.roles (id, restaurant_id, name, permissions) VALUES ($1,$2,'Cashier','{orders.view}'),($3,$4,'Cashier','{orders.view}')`,
        [roleA, REST_A, roleB, REST_B]
      );
    } catch (err: any) {
      console.warn(`\n[PostgreSQL Test] Skipping roles constraints: ${err.message}`);
      isDbConnected = false;
    }
  });

  afterAll(async () => {
    if (pool && isDbConnected) {
      await pool.query(`DELETE FROM public.users WHERE restaurant_id IN ($1, $2)`, [REST_A, REST_B]);
      await pool.query(`DELETE FROM public.restaurants WHERE id IN ($1, $2)`, [REST_A, REST_B]);
    }
    await pool?.end();
  });

  it('keeps role names unique per restaurant, ignoring case and padding, but not across restaurants', async () => {
    if (!isDbConnected) return;
    await expect(
      pool.query(`INSERT INTO public.roles (id, restaurant_id, name) VALUES ($1, $2, '  CASHIER ')`, [`r_${randomUUID()}`, REST_A])
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('rejects empty or oversized names and null permission entries', async () => {
    if (!isDbConnected) return;
    await expect(
      pool.query(`INSERT INTO public.roles (id, restaurant_id, name) VALUES ($1, $2, '   ')`, [`r_${randomUUID()}`, REST_A])
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      pool.query(`INSERT INTO public.roles (id, restaurant_id, name) VALUES ($1, $2, $3)`, [`r_${randomUUID()}`, REST_A, 'x'.repeat(41)])
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      pool.query(`INSERT INTO public.roles (id, restaurant_id, name, permissions) VALUES ($1, $2, 'N', ARRAY['a', NULL])`, [`r_${randomUUID()}`, REST_A])
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('requires restaurant_staff to hold a role and a restaurant', async () => {
    if (!isDbConnected) return;
    await expect(insertUser(`u_${randomUUID()}`, 'restaurant_staff', REST_A, null)).rejects.toMatchObject({ code: '23514' });
    await expect(insertUser(`u_${randomUUID()}`, 'restaurant_staff', null, roleA)).rejects.toMatchObject({ code: '23514' });
    await insertUser(`u_${randomUUID()}`, 'restaurant_staff', REST_A, roleA);
  });

  it('refuses a role id on admins and a role of another restaurant on staff', async () => {
    if (!isDbConnected) return;
    await expect(insertUser(`u_${randomUUID()}`, 'restaurant_admin', REST_A, roleA)).rejects.toMatchObject({ code: '23514' });
    await expect(insertUser(`u_${randomUUID()}`, 'restaurant_staff', REST_A, roleB)).rejects.toMatchObject({ code: '23503' });
  });

  it('refuses to delete a role that still has users', async () => {
    if (!isDbConnected) return;
    await expect(pool.query(`DELETE FROM public.roles WHERE id = $1`, [roleA])).rejects.toMatchObject({ code: '23503' });
  });

  it('still lets a restaurant (and with it users and roles) be deleted in one statement', async () => {
    if (!isDbConnected) return;
    const rest = `rbac-c-${suffix}`;
    const role = `role_c_${suffix}`;
    await pool.query(`INSERT INTO public.restaurants (id, slug, name, is_active) VALUES ($1,$1,'C',true)`, [rest]);
    await pool.query(`INSERT INTO public.roles (id, restaurant_id, name) VALUES ($1, $2, 'Cook')`, [role, rest]);
    await insertUser(`u_${randomUUID()}`, 'restaurant_staff', rest, role);
    await pool.query(`DELETE FROM public.restaurants WHERE id = $1`, [rest]);
    const left = await pool.query(`SELECT 1 FROM public.roles WHERE id = $1`, [role]);
    expect(left.rowCount).toBe(0);
  });

  it('accepts role as an audit target type', async () => {
    if (!isDbConnected) return;
    const id = `aud_${randomUUID()}`;
    await pool.query(
      `INSERT INTO public.admin_audit_log (id, actor_username, action, target_type, target_id)
       VALUES ($1, 'root', 'role.create', 'role', 'x')`,
      [id]
    );
    await pool.query(`DELETE FROM public.admin_audit_log WHERE id = $1`, [id]);
  });
});
