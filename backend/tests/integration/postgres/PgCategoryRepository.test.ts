import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { PgCategoryRepository } from '../../../src/infrastructure/persistence/postgres/PgCategoryRepository.js';
import { Category } from '../../../src/domain/models/Category.js';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/burger_page_test';
const APP_USER_DATABASE_URL =
  process.env.APP_USER_DATABASE_URL || 'postgres://app_user:app_user_test_only@localhost:5432/burger_page_test';

let isDbConnected = false;

describe('PgCategoryRepository (real Postgres, app_user role)', () => {
  let adminPool: pg.Pool;
  let repo: PgCategoryRepository;
  const RESTAURANT_A = `pgcat-rest-a-${randomUUID().slice(0, 8)}`;
  const RESTAURANT_B = `pgcat-rest-b-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    process.env.DATABASE_URL = APP_USER_DATABASE_URL;
    adminPool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2000 });

    try {
      await adminPool.query('SELECT 1');
      isDbConnected = true;
      await adminPool.query(
        `INSERT INTO public.restaurants (id, slug, name, is_active)
         VALUES ($1, $1, 'PgCategory Test A', true), ($2, $2, 'PgCategory Test B', true)
         ON CONFLICT (id) DO UPDATE SET is_active = true`,
        [RESTAURANT_A, RESTAURANT_B]
      );
      repo = new PgCategoryRepository();
    } catch (err: any) {
      console.warn(`\n⚠️ [PgCategoryRepository Test] Skipping: cannot connect (${err.message}).`);
      isDbConnected = false;
    }
  });

  afterEach(async () => {
    if (!isDbConnected) return;
    await adminPool.query(`DELETE FROM public.categories WHERE restaurant_id IN ($1, $2)`, [
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

  it('saves a new category and finds it by id, scoped to its tenant', async () => {
    if (!isDbConnected) return;
    const category: Category = {
      id: `cat-${randomUUID().slice(0, 8)}`,
      restaurantId: RESTAURANT_A,
      name: 'Burgers',
      slug: 'burgers',
      displayOrder: 1,
      isActive: true,
    };

    await repo.save(category);
    const found = await repo.findById(category.id, RESTAURANT_A);

    expect(found).not.toBeNull();
    expect(found?.name).toBe('Burgers');
    expect(found?.restaurantId).toBe(RESTAURANT_A);
  });

  it('does not find a category under a different tenant (RLS-enforced isolation)', async () => {
    if (!isDbConnected) return;
    const category: Category = { id: `cat-${randomUUID().slice(0, 8)}`, restaurantId: RESTAURANT_A, name: 'Drinks' };
    await repo.save(category);

    const foreign = await repo.findById(category.id, RESTAURANT_B);
    expect(foreign).toBeNull();
  });

  it('lists categories for a restaurant ordered by displayOrder then name', async () => {
    if (!isDbConnected) return;
    await repo.save({ id: `cat-${randomUUID().slice(0, 8)}`, restaurantId: RESTAURANT_A, name: 'Zeta', displayOrder: 2 });
    await repo.save({ id: `cat-${randomUUID().slice(0, 8)}`, restaurantId: RESTAURANT_A, name: 'Alpha', displayOrder: 1 });

    const list = await repo.findByRestaurantId(RESTAURANT_A);
    expect(list.map((c) => c.name)).toEqual(['Alpha', 'Zeta']);
  });

  it('finds a category by name (case-insensitive), scoped to tenant', async () => {
    if (!isDbConnected) return;
    await repo.save({ id: `cat-${randomUUID().slice(0, 8)}`, restaurantId: RESTAURANT_A, name: 'Postres' });

    const found = await repo.findByName('postres', RESTAURANT_A);
    expect(found?.name).toBe('Postres');

    const foreign = await repo.findByName('postres', RESTAURANT_B);
    expect(foreign).toBeNull();
  });

  it('updates an existing category on save (upsert semantics)', async () => {
    if (!isDbConnected) return;
    const id = `cat-${randomUUID().slice(0, 8)}`;
    await repo.save({ id, restaurantId: RESTAURANT_A, name: 'Original', displayOrder: 0 });
    await repo.save({ id, restaurantId: RESTAURANT_A, name: 'Renamed', displayOrder: 5 });

    const found = await repo.findById(id, RESTAURANT_A);
    expect(found?.name).toBe('Renamed');
    expect(found?.displayOrder).toBe(5);
  });

  it('deletes a category scoped to its tenant', async () => {
    if (!isDbConnected) return;
    const id = `cat-${randomUUID().slice(0, 8)}`;
    await repo.save({ id, restaurantId: RESTAURANT_A, name: 'ToDelete' });

    await repo.delete(id, RESTAURANT_A);
    expect(await repo.findById(id, RESTAURANT_A)).toBeNull();
  });
});
