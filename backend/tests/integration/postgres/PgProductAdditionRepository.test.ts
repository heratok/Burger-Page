import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { PgProductAdditionRepository } from '../../../src/infrastructure/persistence/postgres/PgProductAdditionRepository.js';
import { ProductAddition } from '../../../src/domain/models/ProductAddition.js';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/burger_page_test';
const APP_USER_DATABASE_URL =
  process.env.APP_USER_DATABASE_URL || 'postgres://app_user:app_user_test_only@localhost:5432/burger_page_test';

let isDbConnected = false;

describe('PgProductAdditionRepository (real Postgres, app_user role)', () => {
  let adminPool: pg.Pool;
  let repo: PgProductAdditionRepository;
  const RESTAURANT_A = `pgadd-rest-a-${randomUUID().slice(0, 8)}`;
  const RESTAURANT_B = `pgadd-rest-b-${randomUUID().slice(0, 8)}`;
  const PRODUCT_A = `pgadd-prod-a-${randomUUID().slice(0, 8)}`;
  const PRODUCT_OTHER = `pgadd-prod-other-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    process.env.DATABASE_URL = APP_USER_DATABASE_URL;
    adminPool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2000 });

    try {
      await adminPool.query('SELECT 1');
      isDbConnected = true;

      const seedClient = await adminPool.connect();
      try {
        await seedClient.query('BEGIN');
        await seedClient.query("SELECT set_config('app.actor_role', 'super_admin', true)");
        await seedClient.query(
          `INSERT INTO public.restaurants (id, slug, name, is_active)
           VALUES ($1, $1, 'PgAddition Test A', true), ($2, $2, 'PgAddition Test B', true)
           ON CONFLICT (id) DO UPDATE SET is_active = true`,
          [RESTAURANT_A, RESTAURANT_B]
        );
        await seedClient.query(
          `INSERT INTO public.products (id, restaurant_id, name, category_name, price, is_available)
           VALUES ($1, $2, 'PgAddition Test Product', 'Burgers', 15000.00, true),
                  ($3, $2, 'PgAddition Test Other Product', 'Burgers', 12000.00, true)
           ON CONFLICT (id, restaurant_id) DO UPDATE SET name = EXCLUDED.name`,
          [PRODUCT_A, RESTAURANT_A, PRODUCT_OTHER]
        );
        await seedClient.query('COMMIT');
      } catch (err) {
        await seedClient.query('ROLLBACK');
        throw err;
      } finally {
        seedClient.release();
      }

      repo = new PgProductAdditionRepository();
    } catch (err: any) {
      console.warn(`\n⚠️ [PgProductAdditionRepository Test] Skipping: cannot connect (${err.message}).`);
      isDbConnected = false;
    }
  });

  afterEach(async () => {
    if (!isDbConnected) return;
    await adminPool.query(`DELETE FROM public.product_additions WHERE restaurant_id IN ($1, $2)`, [
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

  it('saves a new addition and finds it by id, scoped to its tenant', async () => {
    if (!isDbConnected) return;
    const addition = new ProductAddition(
      `add-${randomUUID().slice(0, 8)}`,
      RESTAURANT_A,
      'Extra Queso',
      3000,
      true,
      PRODUCT_A,
      1
    );

    await repo.save(addition);
    const found = await repo.findById(addition.id, RESTAURANT_A);

    expect(found).not.toBeNull();
    expect(found?.name).toBe('Extra Queso');
    expect(found?.price).toBe(3000);
    expect(found?.productId).toBe(PRODUCT_A);
    expect(found?.restaurantId).toBe(RESTAURANT_A);
  });

  it('saves a global addition with no productId', async () => {
    if (!isDbConnected) return;
    const addition = new ProductAddition(`add-${randomUUID().slice(0, 8)}`, RESTAURANT_A, 'Salsa BBQ', 1000);

    await repo.save(addition);
    const found = await repo.findById(addition.id, RESTAURANT_A);

    expect(found).not.toBeNull();
    expect(found?.productId).toBeUndefined();
  });

  it('does not find an addition under a different tenant (RLS-enforced isolation)', async () => {
    if (!isDbConnected) return;
    const addition = new ProductAddition(`add-${randomUUID().slice(0, 8)}`, RESTAURANT_A, 'Tocineta', 2500);
    await repo.save(addition);

    const foreign = await repo.findById(addition.id, RESTAURANT_B);
    expect(foreign).toBeNull();
  });

  it('lists additions for a restaurant ordered by displayOrder', async () => {
    if (!isDbConnected) return;
    await repo.save(
      new ProductAddition(`add-${randomUUID().slice(0, 8)}`, RESTAURANT_A, 'Zeta', 1000, true, undefined, 2)
    );
    await repo.save(
      new ProductAddition(`add-${randomUUID().slice(0, 8)}`, RESTAURANT_A, 'Alpha', 1000, true, undefined, 1)
    );

    const list = await repo.findByRestaurantId(RESTAURANT_A);
    expect(list.map((a) => a.name)).toEqual(['Alpha', 'Zeta']);
  });

  it('does not list restaurant A additions when queried under restaurant B', async () => {
    if (!isDbConnected) return;
    await repo.save(new ProductAddition(`add-${randomUUID().slice(0, 8)}`, RESTAURANT_A, 'OnlyA', 1000));

    const list = await repo.findByRestaurantId(RESTAURANT_B);
    expect(list).toEqual([]);
  });

  it('finds additions by productId, including global (null product_id) additions', async () => {
    if (!isDbConnected) return;
    const specific = new ProductAddition(
      `add-${randomUUID().slice(0, 8)}`,
      RESTAURANT_A,
      'Specific',
      1000,
      true,
      PRODUCT_A
    );
    const global = new ProductAddition(`add-${randomUUID().slice(0, 8)}`, RESTAURANT_A, 'Global', 500);
    await repo.save(specific);
    await repo.save(global);

    const list = await repo.findByProductId(PRODUCT_A, RESTAURANT_A);
    const names = list.map((a) => a.name).sort();
    expect(names).toEqual(['Global', 'Specific']);
  });

  it('does not return an addition tied to a different product from findByProductId', async () => {
    if (!isDbConnected) return;
    const unrelated = new ProductAddition(
      `add-${randomUUID().slice(0, 8)}`,
      RESTAURANT_A,
      'Unrelated',
      1000,
      true,
      PRODUCT_OTHER
    );
    await repo.save(unrelated);

    const list = await repo.findByProductId(PRODUCT_A, RESTAURANT_A);
    expect(list.map((a) => a.name)).not.toContain('Unrelated');
  });

  it('updates an existing addition on save (upsert semantics)', async () => {
    if (!isDbConnected) return;
    const id = `add-${randomUUID().slice(0, 8)}`;
    await repo.save(new ProductAddition(id, RESTAURANT_A, 'Original', 1000, true, undefined, 0));
    await repo.save(new ProductAddition(id, RESTAURANT_A, 'Renamed', 1500, true, undefined, 5));

    const found = await repo.findById(id, RESTAURANT_A);
    expect(found?.name).toBe('Renamed');
    expect(found?.price).toBe(1500);
    expect(found?.isAvailable).toBe(true);
    expect(found?.displayOrder).toBe(5);
  });

  it('deletes an addition scoped to its tenant', async () => {
    if (!isDbConnected) return;
    const id = `add-${randomUUID().slice(0, 8)}`;
    await repo.save(new ProductAddition(id, RESTAURANT_A, 'ToDelete', 1000));

    await repo.delete(id, RESTAURANT_A);
    expect(await repo.findById(id, RESTAURANT_A)).toBeNull();
  });
});
