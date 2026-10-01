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

  describe('financial history is protected from restaurant deletion (db-hardening-0008 T6)', () => {
    const FIN_ID = `pgrest-fin-${randomUUID().slice(0, 8)}`;
    const ORDER_ID = `pgrest-ord-${randomUUID().slice(0, 8)}`;
    const ITEM_ID = `pgrest-item-${randomUUID().slice(0, 8)}`;

    async function seedFinancialHistory() {
      await adminPool.query(
        `INSERT INTO public.restaurants (id, slug, name, is_active) VALUES ($1, $1, 'Fin Test', true) ON CONFLICT (id) DO NOTHING`,
        [FIN_ID]
      );
      await adminPool.query(
        `INSERT INTO public.orders (id, restaurant_id, subtotal, delivery_fee, final_total) VALUES ($1, $2, 10, 0, 10)`,
        [ORDER_ID, FIN_ID]
      );
      await adminPool.query(
        `INSERT INTO public.order_items (id, order_id, restaurant_id, product_name, unit_price, quantity)
         VALUES ($1, $2, $3, 'Burger', 10, 1)`,
        [ITEM_ID, ORDER_ID, FIN_ID]
      );
    }

    it.each([
      'orders_restaurant_id_fkey',
      'order_items_restaurant_id_fkey',
      'order_item_additions_restaurant_id_fkey',
      'order_status_history_restaurant_id_fkey',
    ])('%s is ON DELETE RESTRICT', async (name) => {
      if (!isDbConnected) return;
      const { rows } = await adminPool.query(`SELECT confdeltype FROM pg_constraint WHERE conname = $1`, [name]);
      expect(rows).toEqual([{ confdeltype: 'r' }]);
    });

    it('a raw restaurant delete is refused while orders exist (no silent cascade of sales)', async () => {
      if (!isDbConnected) return;
      await seedFinancialHistory();
      try {
        await expect(adminPool.query(`DELETE FROM public.restaurants WHERE id = $1`, [FIN_ID])).rejects.toMatchObject({
          code: '23503',
        });
        expect((await adminPool.query(`SELECT 1 FROM public.orders WHERE id = $1`, [ORDER_ID])).rowCount).toBe(1);
        expect((await adminPool.query(`SELECT 1 FROM public.order_status_history WHERE order_id = $1`, [ORDER_ID])).rowCount).toBe(1);
      } finally {
        await adminPool.query(`DELETE FROM public.orders WHERE restaurant_id = $1`, [FIN_ID]);
        await adminPool.query(`DELETE FROM public.restaurants WHERE id = $1`, [FIN_ID]);
      }
    });

    it('hardDelete still removes a restaurant together with its orders, items and history', async () => {
      if (!isDbConnected) return;
      await seedFinancialHistory();
      await repo.hardDelete?.(FIN_ID);
      for (const table of ['restaurants', 'orders', 'order_items', 'order_status_history']) {
        const col = table === 'restaurants' ? 'id' : 'restaurant_id';
        expect((await adminPool.query(`SELECT 1 FROM public.${table} WHERE ${col} = $1`, [FIN_ID])).rowCount, table).toBe(0);
      }
    });
  });
});
