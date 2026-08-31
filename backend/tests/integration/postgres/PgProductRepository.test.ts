import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { PgProductRepository } from '../../../src/infrastructure/persistence/postgres/PgProductRepository.js';
import { Product } from '../../../src/domain/models/Product.js';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/burger_page_test';
const APP_USER_DATABASE_URL =
  process.env.APP_USER_DATABASE_URL || 'postgres://app_user:app_user_test_only@localhost:5432/burger_page_test';

let isDbConnected = false;

describe('PgProductRepository (real Postgres, app_user role)', () => {
  let adminPool: pg.Pool;
  let repo: PgProductRepository;
  const RESTAURANT_A = `pgprod-rest-a-${randomUUID().slice(0, 8)}`;
  const RESTAURANT_B = `pgprod-rest-b-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    process.env.DATABASE_URL = APP_USER_DATABASE_URL;
    adminPool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2000 });

    try {
      await adminPool.query('SELECT 1');
      isDbConnected = true;
      await adminPool.query(
        `INSERT INTO public.restaurants (id, slug, name, is_active)
         VALUES ($1, $1, 'PgProduct Test A', true), ($2, $2, 'PgProduct Test B', true)
         ON CONFLICT (id) DO UPDATE SET is_active = true`,
        [RESTAURANT_A, RESTAURANT_B]
      );
      repo = new PgProductRepository();
    } catch (err: any) {
      console.warn(`\n⚠️ [PgProductRepository Test] Skipping: cannot connect (${err.message}).`);
      isDbConnected = false;
    }
  });

  afterEach(async () => {
    if (!isDbConnected) return;
    await adminPool.query(`DELETE FROM public.products WHERE restaurant_id IN ($1, $2)`, [
      RESTAURANT_A,
      RESTAURANT_B,
    ]);
  });

  afterAll(async () => {
    if (isDbConnected) {
      await adminPool.query(`DELETE FROM public.restaurants WHERE id IN ($1, $2)`, [RESTAURANT_A, RESTAURANT_B]);
    }
    await adminPool?.end();
  });

  it('saves a new product and finds it by id, scoped to its tenant', async () => {
    if (!isDbConnected) return;
    const product: Product = {
      id: `prod-${randomUUID().slice(0, 8)}`,
      restaurantId: RESTAURANT_A,
      name: 'Classic Burger',
      description: 'Beef, cheese, lettuce',
      price: 15000,
      category: 'Burgers',
      isAvailable: true,
      isPopular: true,
      isNew: false,
      preparationTimeMinutes: 12,
      displayOrder: 1,
    };

    await repo.save(product);
    const found = await repo.findById(product.id, RESTAURANT_A);

    expect(found).not.toBeNull();
    expect(found?.name).toBe('Classic Burger');
    expect(found?.description).toBe('Beef, cheese, lettuce');
    expect(found?.price).toBe(15000);
    expect(found?.category).toBe('Burgers');
    expect(found?.restaurantId).toBe(RESTAURANT_A);
    expect(found?.isAvailable).toBe(true);
    expect(found?.isPopular).toBe(true);
    expect(found?.isNew).toBe(false);
    expect(found?.preparationTimeMinutes).toBe(12);
    expect(found?.displayOrder).toBe(1);
  });

  it('does not find a product under a different tenant (RLS-enforced isolation)', async () => {
    if (!isDbConnected) return;
    const product: Product = {
      id: `prod-${randomUUID().slice(0, 8)}`,
      restaurantId: RESTAURANT_A,
      name: 'Secret Sauce Burger',
      description: '',
      price: 20000,
      category: 'Burgers',
      isAvailable: true,
    };
    await repo.save(product);

    const foreign = await repo.findById(product.id, RESTAURANT_B);
    expect(foreign).toBeNull();
  });

  it('lists products for a restaurant ordered by displayOrder then id, and does not leak other tenants', async () => {
    if (!isDbConnected) return;
    await repo.save({
      id: `prod-${randomUUID().slice(0, 8)}`,
      restaurantId: RESTAURANT_A,
      name: 'Zeta Burger',
      description: '',
      price: 10000,
      category: 'Burgers',
      isAvailable: true,
      displayOrder: 2,
    });
    await repo.save({
      id: `prod-${randomUUID().slice(0, 8)}`,
      restaurantId: RESTAURANT_A,
      name: 'Alpha Burger',
      description: '',
      price: 10000,
      category: 'Burgers',
      isAvailable: true,
      displayOrder: 1,
    });
    await repo.save({
      id: `prod-${randomUUID().slice(0, 8)}`,
      restaurantId: RESTAURANT_B,
      name: 'Foreign Burger',
      description: '',
      price: 10000,
      category: 'Burgers',
      isAvailable: true,
      displayOrder: 0,
    });

    const list = await repo.findByRestaurantId(RESTAURANT_A);
    expect(list.map((p) => p.name)).toEqual(['Alpha Burger', 'Zeta Burger']);
    expect(list.every((p) => p.restaurantId === RESTAURANT_A)).toBe(true);
  });

  it('updates an existing product on save (upsert semantics)', async () => {
    if (!isDbConnected) return;
    const id = `prod-${randomUUID().slice(0, 8)}`;
    await repo.save({
      id,
      restaurantId: RESTAURANT_A,
      name: 'Original Burger',
      description: 'v1',
      price: 10000,
      category: 'Burgers',
      isAvailable: true,
      displayOrder: 0,
    });
    await repo.save({
      id,
      restaurantId: RESTAURANT_A,
      name: 'Renamed Burger',
      description: 'v2',
      price: 12500,
      category: 'Combos',
      isAvailable: true,
      displayOrder: 5,
    });

    const found = await repo.findById(id, RESTAURANT_A);
    expect(found?.name).toBe('Renamed Burger');
    expect(found?.description).toBe('v2');
    expect(found?.price).toBe(12500);
    expect(found?.category).toBe('Combos');
    expect(found?.isAvailable).toBe(true);
    expect(found?.displayOrder).toBe(5);
  });

  it('deletes a product scoped to its tenant', async () => {
    if (!isDbConnected) return;
    const id = `prod-${randomUUID().slice(0, 8)}`;
    await repo.save({
      id,
      restaurantId: RESTAURANT_A,
      name: 'ToDelete Burger',
      description: '',
      price: 10000,
      category: 'Burgers',
      isAvailable: true,
    });

    await repo.delete(id, RESTAURANT_A);
    expect(await repo.findById(id, RESTAURANT_A)).toBeNull();
  });
});
