import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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

    await repo.save(user);
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
});
