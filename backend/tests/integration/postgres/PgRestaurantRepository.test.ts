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
      schedule: [{ dayOfWeek: 1, open: '12:00', close: '22:00' }],
      timezone: 'America/Bogota',
      ordersPaused: false,
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

  it('pausing (is_active=false via save) keeps the restaurant findable by super_admin and listed', async () => {
    if (!isDbConnected) return;
    const current = (await repo.findById(RESTAURANT_ID))!;
    await repo.save({ ...current, isActive: false });
    expect((await repo.findById(RESTAURANT_ID))?.isActive).toBe(false);
    expect((await repo.findAll()).some((r) => r.id === RESTAURANT_ID)).toBe(true);
    await repo.save({ ...current, isActive: true });
  });

  it('delete() sets deleted_at, hides the restaurant everywhere and frees its slug', async () => {
    if (!isDbConnected) return;
    await repo.delete(RESTAURANT_ID);

    expect(await repo.findById(RESTAURANT_ID)).toBeNull();
    expect(await repo.findBySlug(RESTAURANT_ID)).toBeNull();
    expect((await repo.findAll()).some((r) => r.id === RESTAURANT_ID)).toBe(false);

    const { rows } = await adminPool.query(
      `SELECT slug, is_active, deleted_at FROM public.restaurants WHERE id = $1`,
      [RESTAURANT_ID]
    );
    expect(rows[0].deleted_at).not.toBeNull();
    expect(rows[0].is_active).toBe(false);
    expect(rows[0].slug).toBe(`${RESTAURANT_ID}-deleted-${RESTAURANT_ID}`);
  });

  it('a deleted restaurant cannot be resurrected by save()', async () => {
    if (!isDbConnected) return;
    await repo.save({
      id: RESTAURANT_ID,
      slug: RESTAURANT_ID,
      name: 'Zombie',
      theme: 'dark-charcoal',
      schedule: [],
      timezone: 'America/Bogota',
      ordersPaused: false,
      isActive: true,
    });
    expect(await repo.findById(RESTAURANT_ID)).toBeNull();
  });

  it('hard-deletes a restaurant', async () => {
    if (!isDbConnected) return;
    await repo.hardDelete?.(RESTAURANT_ID);
    const { rowCount } = await adminPool.query(`SELECT 1 FROM public.restaurants WHERE id = $1`, [RESTAURANT_ID]);
    expect(rowCount).toBe(0);
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
  describe('weekly schedule, timezone and paused flag (store-opening-hours T2)', () => {
    const HOURS_ID = `pgrest-hours-${randomUUID().slice(0, 8)}`;
    const restaurant = (extra: Partial<Restaurant> = {}): Restaurant => ({
      id: HOURS_ID,
      slug: HOURS_ID,
      name: 'Pg Hours Restaurant',
      theme: 'dark-charcoal',
      isActive: true,
      schedule: [
        { dayOfWeek: 1, open: '12:00', close: '14:30' },
        { dayOfWeek: 1, open: '18:00', close: '02:00' },
        { dayOfWeek: 6, open: '10:00', close: '23:00' },
      ],
      timezone: 'America/Bogota',
      ordersPaused: false,
      ...extra,
    });

    afterAll(async () => {
      if (isDbConnected) await adminPool.query(`DELETE FROM public.restaurants WHERE id = $1`, [HOURS_ID]);
    });

    it('round-trips the schedule (multiple ranges, overnight), timezone and paused flag by id and by public slug', async () => {
      if (!isDbConnected) return;
      await repo.save(restaurant({ timezone: 'America/Mexico_City', ordersPaused: true }));

      for (const found of [await repo.findById(HOURS_ID), await repo.findBySlug(HOURS_ID)]) {
        expect(found?.schedule).toEqual([
          { dayOfWeek: 1, open: '12:00', close: '14:30' },
          { dayOfWeek: 1, open: '18:00', close: '02:00' },
          { dayOfWeek: 6, open: '10:00', close: '23:00' },
        ]);
        expect(found?.timezone).toBe('America/Mexico_City');
        expect(found?.ordersPaused).toBe(true);
      }
    });

    it('derives the legacy openingHours object and config.openingHours text from the schedule', async () => {
      if (!isDbConnected) return;
      await repo.save(restaurant());
      const found = await repo.findById(HOURS_ID);
      expect(found?.openingHours).toBeDefined();
      expect(found?.config.openingHours).toBe(`${found?.openingHours?.open} - ${found?.openingHours?.close}`);
      expect(['12:00', '10:00']).toContain(found?.openingHours?.open);
    });

    it('replaces the whole schedule on save and keeps only the new ranges', async () => {
      if (!isDbConnected) return;
      await repo.save(restaurant());
      await repo.save(restaurant({ schedule: [{ dayOfWeek: 3, open: '09:00', close: '17:00' }] }));
      expect((await repo.findById(HOURS_ID))?.schedule).toEqual([{ dayOfWeek: 3, open: '09:00', close: '17:00' }]);
      const { rowCount } = await adminPool.query(
        `SELECT 1 FROM public.restaurant_opening_hours WHERE restaurant_id = $1`,
        [HOURS_ID]
      );
      expect(rowCount).toBe(1);
    });

    it('an empty schedule means closed every day: no rows, no legacy hours', async () => {
      if (!isDbConnected) return;
      await repo.save(restaurant({ schedule: [] }));
      const found = await repo.findById(HOURS_ID);
      expect(found?.schedule).toEqual([]);
      expect(found?.openingHours).toBeUndefined();
      expect(found?.config.openingHours).toBe('');
    });

    it('stores uuidv7 based ids with the oh_ prefix', async () => {
      if (!isDbConnected) return;
      await repo.save(restaurant());
      const { rows } = await adminPool.query(
        `SELECT id FROM public.restaurant_opening_hours WHERE restaurant_id = $1`,
        [HOURS_ID]
      );
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) expect(r.id).toMatch(/^oh_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('rejects a bad weekday at the database level (23514), rolling the save back', async () => {
      if (!isDbConnected) return;
      await repo.save(restaurant());
      await expect(
        repo.save(restaurant({ schedule: [{ dayOfWeek: 9, open: '09:00', close: '17:00' }] }))
      ).rejects.toMatchObject({ code: '23514' });
      expect((await repo.findById(HOURS_ID))?.schedule.length).toBe(3);
    });

    it('hardDelete removes the schedule rows with the restaurant', async () => {
      if (!isDbConnected) return;
      await repo.save(restaurant());
      await repo.hardDelete?.(HOURS_ID);
      const { rowCount } = await adminPool.query(
        `SELECT 1 FROM public.restaurant_opening_hours WHERE restaurant_id = $1`,
        [HOURS_ID]
      );
      expect(rowCount).toBe(0);
    });
  });

});
