import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { PgRestaurantRepository } from '../../../src/infrastructure/persistence/postgres/PgRestaurantRepository.js';
import { Restaurant } from '../../../src/domain/models/Restaurant.js';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/burger_page_test';
const APP_USER_DATABASE_URL =
  process.env.APP_USER_DATABASE_URL || 'postgres://app_user:app_user_test_only@localhost:5432/burger_page_test';

let isDbConnected = false;

describe('PgRestaurantRepository (real Postgres, app_user role)', () => {
  let adminPool: pg.Pool;
  let repo: PgRestaurantRepository;
  const RESTAURANT_ID = `pgrest-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    process.env.DATABASE_URL = APP_USER_DATABASE_URL;
    adminPool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2000 });
    try {
      await adminPool.query('SELECT 1');
      isDbConnected = true;
      repo = new PgRestaurantRepository();
    } catch (err: any) {
      console.warn(`\n⚠️ [PgRestaurantRepository Test] Skipping: cannot connect (${err.message}).`);
      isDbConnected = false;
    }
  });

  afterAll(async () => {
    if (isDbConnected) {
      await adminPool.query(`DELETE FROM public.restaurants WHERE id = $1`, [RESTAURANT_ID]);
    }
    await adminPool?.end();
  });

  it('saves a new restaurant and finds it by id and by slug', async () => {
    if (!isDbConnected) return;
    const restaurant: Restaurant = {
      id: RESTAURANT_ID,
      slug: RESTAURANT_ID,
      name: 'Pg Test Restaurant',
      theme: 'dark-charcoal',
      openingHours: { open: '12:00', close: '22:00' },
      isActive: true,
    };

    await repo.save(restaurant);
    const byId = await repo.findById(RESTAURANT_ID);
    const bySlug = await repo.findBySlug(RESTAURANT_ID);

    expect(byId?.name).toBe('Pg Test Restaurant');
    expect(bySlug?.id).toBe(RESTAURANT_ID);
  });

  it('lists all restaurants including this one', async () => {
    if (!isDbConnected) return;
    const list = await repo.findAll();
    expect(list.some((r) => r.id === RESTAURANT_ID)).toBe(true);
  });

  it('soft-deletes a restaurant (is_active=false) and it stays findable by id (super_admin visibility)', async () => {
    if (!isDbConnected) return;
    await repo.delete(RESTAURANT_ID);
    const found = await repo.findById(RESTAURANT_ID);
    expect(found?.isActive).toBe(false);
  });

  it('hard-deletes a restaurant', async () => {
    if (!isDbConnected) return;
    await repo.hardDelete?.(RESTAURANT_ID);
    expect(await repo.findById(RESTAURANT_ID)).toBeNull();
  });
});
