import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { PgUserRepository } from '../../../src/infrastructure/persistence/postgres/PgUserRepository.js';
import { User } from '../../../src/domain/models/User.js';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/burger_page_test';
const APP_USER_DATABASE_URL =
  process.env.APP_USER_DATABASE_URL || 'postgres://app_user:app_user_test_only@localhost:5432/burger_page_test';

let isDbConnected = false;

describe('PgUserRepository (real Postgres, app_user role — login is the pre-tenant-context seam)', () => {
  let adminPool: pg.Pool;
  let repo: PgUserRepository;
  const RESTAURANT_A = `pguser-rest-a-${randomUUID().slice(0, 8)}`;
  const RESTAURANT_B = `pguser-rest-b-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    process.env.DATABASE_URL = APP_USER_DATABASE_URL;
    adminPool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2000 });

    try {
      await adminPool.query('SELECT 1');
      isDbConnected = true;
      await adminPool.query(
        `INSERT INTO public.restaurants (id, slug, name, is_active) VALUES ($1,$1,'A',true),($2,$2,'B',true) ON CONFLICT (id) DO UPDATE SET is_active = true`,
        [RESTAURANT_A, RESTAURANT_B]
      );
      repo = new PgUserRepository();
    } catch (err: any) {
      console.warn(`\n⚠️ [PgUserRepository Test] Skipping: cannot connect (${err.message}).`);
      isDbConnected = false;
    }
  });

  afterAll(async () => {
    if (isDbConnected) {
      await adminPool.query(`DELETE FROM public.restaurants WHERE id IN ($1, $2)`, [RESTAURANT_A, RESTAURANT_B]);
    }
    await adminPool?.end();
  });

  it('saves a restaurant_admin user and finds it by username without any tenant context (login seam)', async () => {
    if (!isDbConnected) return;
    const user: User = {
      id: `usr-${randomUUID().slice(0, 8)}`,
      username: `admin-${randomUUID().slice(0, 8)}`,
      passwordHash: 'hash',
      role: 'restaurant_admin',
      restaurantId: RESTAURANT_A,
      createdAt: new Date().toISOString(),
    };

    await repo.save(user);
    const found = await repo.findByUsername(user.username);

    expect(found).not.toBeNull();
    expect(found?.restaurantId).toBe(RESTAURANT_A);
  });

  it('saves a super_admin user with no restaurantId', async () => {
    if (!isDbConnected) return;
    const user: User = {
      id: `usr-${randomUUID().slice(0, 8)}`,
      username: `superadmin-${randomUUID().slice(0, 8)}`,
      passwordHash: 'hash',
      role: 'super_admin',
      createdAt: new Date().toISOString(),
    };

    // Platform rows (restaurant_id IS NULL) are reserved for super_admin
    // sessions (JD-CONF-01 write policy): the caller passes its granted
    // super_admin role through the repository port, mirroring how an
    // authenticated super_admin provisions platform accounts in production
    // (SUS-03: actor_role comes from the caller's granted role, never a
    // hardcoded value).
    await repo.save(user, 'super_admin');
    const found = await repo.findById(user.id);

    expect(found).not.toBeNull();
    expect(found?.restaurantId).toBeUndefined();
    expect(found?.role).toBe('super_admin');
  });

  it('findByRestaurantId lists only that tenant\'s users', async () => {
    if (!isDbConnected) return;
    const user: User = {
      id: `usr-${randomUUID().slice(0, 8)}`,
      username: `list-${randomUUID().slice(0, 8)}`,
      passwordHash: 'hash',
      role: 'restaurant_admin',
      restaurantId: RESTAURANT_A,
      createdAt: new Date().toISOString(),
    };
    await repo.save(user);

    const listA = await repo.findByRestaurantId(RESTAURANT_A);
    expect(listA.some((u) => u.id === user.id)).toBe(true);

    const listB = await repo.findByRestaurantId(RESTAURANT_B);
    expect(listB.some((u) => u.id === user.id)).toBe(false);
  });

  it('deletes a user by id regardless of tenant', async () => {
    if (!isDbConnected) return;
    const user: User = {
      id: `usr-${randomUUID().slice(0, 8)}`,
      username: `todelete-${randomUUID().slice(0, 8)}`,
      passwordHash: 'hash',
      role: 'restaurant_admin',
      restaurantId: RESTAURANT_A,
      createdAt: new Date().toISOString(),
    };
    await repo.save(user);

    await repo.delete(user.id);
    expect(await repo.findById(user.id)).toBeNull();
  });

  describe('account state columns (is_active, must_change_password)', () => {
    const make = (restaurantId = RESTAURANT_A): User => ({
      id: `usr-${randomUUID().slice(0, 8)}`,
      username: `state-${randomUUID().slice(0, 8)}`,
      passwordHash: 'hash',
      role: 'restaurant_admin',
      restaurantId,
      createdAt: new Date().toISOString(),
    });

    it('new users default to active with no pending password change', async () => {
      if (!isDbConnected) return;
      const user = make();
      await repo.save(user);
      const found = await repo.findById(user.id);
      expect(found?.isActive).toBe(true);
      expect(found?.mustChangePassword).toBe(false);
    });

    it('persists isActive on update, as super admin', async () => {
      if (!isDbConnected) return;
      const user = make();
      await repo.save(user);

      await repo.save({ ...user, isActive: false }, 'super_admin');
      expect((await repo.findById(user.id))?.isActive).toBe(false);

      await repo.save({ ...user, isActive: true }, 'super_admin');
      expect((await repo.findById(user.id))?.isActive).toBe(true);
    });

    it('persists mustChangePassword and the new hash on update; an undefined flag leaves state untouched', async () => {
      if (!isDbConnected) return;
      const user = make();
      await repo.save(user);

      await repo.save({ ...user, passwordHash: 'temp-hash', mustChangePassword: true }, 'super_admin');
      let found = await repo.findById(user.id);
      expect(found?.passwordHash).toBe('temp-hash');
      expect(found?.mustChangePassword).toBe(true);

      // A plain save (no flags) must not reset the stored state.
      await repo.save({ ...user, passwordHash: 'temp-hash' }, 'super_admin');
      found = await repo.findById(user.id);
      expect(found?.mustChangePassword).toBe(true);
      expect(found?.isActive).toBe(true);

      // A tenant admin can clear its own flag (change-password path).
      await repo.save({ ...user, passwordHash: 'own-hash', mustChangePassword: false }, 'restaurant_admin');
      found = await repo.findById(user.id);
      expect(found?.mustChangePassword).toBe(false);
      expect(found?.passwordHash).toBe('own-hash');
    });

    it('super admin deletes a tenant user with the actor role', async () => {
      if (!isDbConnected) return;
      const user = make();
      await repo.save(user);
      await repo.delete(user.id, 'super_admin');
      expect(await repo.findById(user.id)).toBeNull();
    });

  describe('atomic guards and narrow writes', () => {
    const mk = (role: 'super_admin' | 'restaurant_admin', restaurantId?: string): User => ({
      id: `usr-${randomUUID().slice(0, 8)}`,
      username: `u-${randomUUID().slice(0, 8)}`,
      passwordHash: 'hash',
      role,
      restaurantId,
      createdAt: new Date().toISOString(),
    });

    it('setActive updates only is_active (a concurrent hash change survives)', async () => {
      if (!isDbConnected) return;
      const user = mk('restaurant_admin', RESTAURANT_A);
      await repo.save(user);
      await adminPool.query(`UPDATE public.users SET password_hash = 'fresh', must_change_password = true WHERE id = $1`, [user.id]);

      expect(await repo.setActive(user.id, false)).toBe('done');

      const { rows } = await adminPool.query(`SELECT password_hash, must_change_password, is_active FROM public.users WHERE id = $1`, [user.id]);
      expect(rows[0]).toMatchObject({ password_hash: 'fresh', must_change_password: true, is_active: false });
      expect(await repo.setActive('does-not-exist', false)).toBe('not_found');
    });

    describe('last active super admin (serialized with row locks)', () => {
      let others: string[] = [];
      let a: User;
      let b: User;
      beforeEach(async () => {
        if (!isDbConnected) return;
        const { rows } = await adminPool.query(`SELECT id FROM public.users WHERE role = 'super_admin' AND is_active`);
        others = rows.map((r) => r.id);
        if (others.length) await adminPool.query(`UPDATE public.users SET is_active = false WHERE id = ANY($1)`, [others]);
        a = mk('super_admin');
        b = mk('super_admin');
        await repo.save(a, 'super_admin');
        await repo.save(b, 'super_admin');
      });
      afterEach(async () => {
        if (!isDbConnected) return;
        await adminPool.query(`DELETE FROM public.users WHERE id = ANY($1)`, [[a.id, b.id]]);
        if (others.length) await adminPool.query(`UPDATE public.users SET is_active = true WHERE id = ANY($1)`, [others]);
      });

      it('two concurrent deactivations leave exactly one active super admin', async () => {
        if (!isDbConnected) return;
        const results = await Promise.all([repo.setActive(a.id, false), repo.setActive(b.id, false)]);
        expect(results.filter((r) => r === 'done')).toHaveLength(1);
        expect(results.filter((r) => r === 'last_super_admin')).toHaveLength(1);
        const { rows } = await adminPool.query(`SELECT count(*)::int AS n FROM public.users WHERE id = ANY($1) AND is_active`, [[a.id, b.id]]);
        expect(rows[0].n).toBe(1);
      });

      it('two concurrent deletes leave exactly one super admin', async () => {
        if (!isDbConnected) return;
        const results = await Promise.all([repo.deleteGuarded(a.id), repo.deleteGuarded(b.id)]);
        expect(results.filter((r) => r === 'done')).toHaveLength(1);
        expect(results.filter((r) => r === 'last_super_admin')).toHaveLength(1);
        const { rows } = await adminPool.query(`SELECT count(*)::int AS n FROM public.users WHERE id = ANY($1)`, [[a.id, b.id]]);
        expect(rows[0].n).toBe(1);
      });

      it('allows removing a super admin while another stays active, and reactivating is never blocked', async () => {
        if (!isDbConnected) return;
        expect(await repo.setActive(a.id, false)).toBe('done');
        expect(await repo.setActive(a.id, true)).toBe('done');
        expect(await repo.deleteGuarded(a.id)).toBe('done');
        expect(await repo.deleteGuarded('nope')).toBe('not_found');
      });
    });

    it('retireByRestaurantId deactivates the tenant users and renames their usernames, idempotently', async () => {
      if (!isDbConnected) return;
      const u1 = mk('restaurant_admin', RESTAURANT_B);
      const u2 = mk('restaurant_admin', RESTAURANT_B);
      const other = mk('restaurant_admin', RESTAURANT_A);
      await repo.save(u1);
      await repo.save(u2);
      await repo.save(other);

      await repo.retireByRestaurantId(RESTAURANT_B);
      await repo.retireByRestaurantId(RESTAURANT_B);

      const { rows } = await adminPool.query(`SELECT id, username, is_active FROM public.users WHERE id = ANY($1)`, [[u1.id, u2.id, other.id]]);
      const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
      expect(byId[u1.id]).toMatchObject({ username: `${u1.username}-deleted-${RESTAURANT_B}`, is_active: false });
      expect(byId[u2.id].is_active).toBe(false);
      expect(byId[other.id]).toMatchObject({ username: other.username, is_active: true });
      expect(await repo.findByUsername(u1.username)).toBeNull();
    });
  });
  });
});
