import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { PgOrderRepository } from '../../../src/infrastructure/persistence/postgres/PgOrderRepository.js';
import { Order } from '../../../src/domain/models/Order.js';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/burger_page_test';
const APP_USER_DATABASE_URL =
  process.env.APP_USER_DATABASE_URL || 'postgres://app_user:app_user_test_only@localhost:5432/burger_page_test';

let isDbConnected = false;

describe('PgOrderRepository (real Postgres, app_user role, via create_order_atomic RPC)', () => {
  let adminPool: pg.Pool;
  let repo: PgOrderRepository;
  const RESTAURANT_A = `pgorder-rest-a-${randomUUID().slice(0, 8)}`;
  const RESTAURANT_B = `pgorder-rest-b-${randomUUID().slice(0, 8)}`;
  const PRODUCT_ID = `pgorder-prod-${randomUUID().slice(0, 8)}`;

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
      await adminPool.query(
        `INSERT INTO public.products (id, restaurant_id, category_name, name, price, is_available)
         VALUES ($1, $2, 'Burgers', 'Test Burger', 15000, true)
         ON CONFLICT (id, restaurant_id) DO UPDATE SET is_available = true`,
        [PRODUCT_ID, RESTAURANT_A]
      );
      repo = new PgOrderRepository();
    } catch (err: any) {
      console.warn(`\n⚠️ [PgOrderRepository Test] Skipping: cannot connect (${err.message}).`);
      isDbConnected = false;
    }
  });

  afterAll(async () => {
    if (isDbConnected) {
      await adminPool.query(`DELETE FROM public.restaurants WHERE id IN ($1, $2)`, [RESTAURANT_A, RESTAURANT_B]);
    }
    await adminPool?.end();
  });

  it('creates an order atomically and reads it back with items', async () => {
    if (!isDbConnected) return;
    const order = new Order(
      `ord-${randomUUID().slice(0, 8)}`,
      RESTAURANT_A,
      undefined,
      [{ id: `item-${randomUUID().slice(0, 8)}`, productId: PRODUCT_ID, productName: 'ignored', unitPrice: 0, quantity: 2 }],
      'pending',
      new Date(),
      0,
      undefined,
      'Efectivo'
    );

    await repo.save(order);
    const found = await repo.findById(order.id, RESTAURANT_A);

    expect(found).not.toBeNull();
    expect(found?.items.length).toBe(1);
    expect(found?.items[0].productId).toBe(PRODUCT_ID);
    expect(found?.items[0].quantity).toBe(2);
    expect(found?.items[0].unitPrice).toBe(15000);
    expect(found?.subtotal).toBe(30000);
  });

  it('does not find an order under a different tenant (RLS-enforced isolation)', async () => {
    if (!isDbConnected) return;
    const order = new Order(
      `ord-${randomUUID().slice(0, 8)}`,
      RESTAURANT_A,
      undefined,
      [{ id: `item-${randomUUID().slice(0, 8)}`, productId: PRODUCT_ID, productName: 'ignored', unitPrice: 0, quantity: 1 }],
      'pending',
      new Date()
    );
    await repo.save(order);

    const foreign = await repo.findById(order.id, RESTAURANT_B);
    expect(foreign).toBeNull();
  });

  it('updates order status through the audited RPC', async () => {
    if (!isDbConnected) return;
    const order = new Order(
      `ord-${randomUUID().slice(0, 8)}`,
      RESTAURANT_A,
      undefined,
      [{ id: `item-${randomUUID().slice(0, 8)}`, productId: PRODUCT_ID, productName: 'ignored', unitPrice: 0, quantity: 1 }],
      'pending',
      new Date()
    );
    await repo.save(order);

    await repo.updateStatus(order.id, 'cooking', RESTAURANT_A);
    const found = await repo.findById(order.id, RESTAURANT_A);
    expect(found?.status).toBe('cooking');
  });

  it('lists orders for a restaurant', async () => {
    if (!isDbConnected) return;
    const order = new Order(
      `ord-${randomUUID().slice(0, 8)}`,
      RESTAURANT_A,
      undefined,
      [{ id: `item-${randomUUID().slice(0, 8)}`, productId: PRODUCT_ID, productName: 'ignored', unitPrice: 0, quantity: 1 }],
      'pending',
      new Date()
    );
    await repo.save(order);

    const list = await repo.findByRestaurantId(RESTAURANT_A);
    expect(list.some((o) => o.id === order.id)).toBe(true);
  });
});
