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
        `INSERT INTO public.products (id, restaurant_id, name, price, is_available)
         VALUES ($1, $2, 'Test Burger', 15000, true)
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

  describe('create_order_atomic delivery fee contract (JD-REJ-03)', () => {
    // JD-REJ-03: the schema change added p_delivery_fee as the 9th RPC arg
    // (negative-fee guard + COALESCE fallback). These tests exercise the REAL
    // RPC through repository.save() so a parameter-order mismatch, missing
    // overload, or GRANT failure on a live database fails here.

    it('honors an explicit delivery fee end-to-end and persists it', async () => {
      if (!isDbConnected) return;
      const order = new Order(
        `ord-${randomUUID().slice(0, 8)}`,
        RESTAURANT_A,
        undefined,
        [{ id: `item-${randomUUID().slice(0, 8)}`, productId: PRODUCT_ID, productName: 'ignored', unitPrice: 0, quantity: 2 }],
        'pending',
        new Date(),
        5000,
        undefined,
        'Efectivo'
      );

      await repo.save(order);
      const found = await repo.findById(order.id, RESTAURANT_A);

      expect(found).not.toBeNull();
      // subtotal: 2 x 15000 = 30000; explicit fee must land on delivery_fee and final_total.
      expect(found?.deliveryFee).toBe(5000);
      expect(found?.subtotal).toBe(30000);
      expect(found?.finalTotal).toBe(35000);

      // Raw row check through the admin pool (bypasses RLS): the stored
      // columns must match the explicit fee, not the restaurant default (0).
      const { rows } = await adminPool.query(`SELECT delivery_fee, final_total FROM public.orders WHERE id = $1`, [
        order.id,
      ]);
      expect(rows.length).toBe(1);
      expect(Number(rows[0].delivery_fee)).toBe(5000);
      expect(Number(rows[0].final_total)).toBe(35000);
    });

    it('honors an explicit zero fee over a configured restaurant fee (counter-sale semantics)', async () => {
      if (!isDbConnected) return;
      // The configured fee lives in restaurant_settings since the 3NF split.
      await adminPool.query(
        `INSERT INTO public.restaurant_settings (restaurant_id, delivery_fee)
         VALUES ($1, 5000)
         ON CONFLICT (restaurant_id) DO UPDATE SET delivery_fee = EXCLUDED.delivery_fee`,
        [RESTAURANT_A]
      );
      try {
        const order = new Order(
          `ord-${randomUUID().slice(0, 8)}`,
          RESTAURANT_A,
          undefined,
          [{ id: `item-${randomUUID().slice(0, 8)}`, productId: PRODUCT_ID, productName: 'ignored', unitPrice: 0, quantity: 1 }],
          'pending',
          new Date(),
          0,
          undefined,
          'Efectivo'
        );

        await repo.save(order);
        const found = await repo.findById(order.id, RESTAURANT_A);

        expect(found).not.toBeNull();
        expect(found?.deliveryFee).toBe(0);
        expect(found?.finalTotal).toBe(found ? found.subtotal : NaN);

        const { rows } = await adminPool.query(`SELECT delivery_fee, final_total FROM public.orders WHERE id = $1`, [
          order.id,
        ]);
        expect(Number(rows[0].delivery_fee)).toBe(0);
        expect(Number(rows[0].final_total)).toBe(15000);
      } finally {
        // Keep the shared fixture hermetic for the rest of the suite.
        await adminPool.query(
          `UPDATE public.restaurant_settings SET delivery_fee = 0 WHERE restaurant_id = $1`,
          [RESTAURANT_A]
        );
      }
    });

    it('rejects a negative delivery fee at the RPC level', async () => {
      if (!isDbConnected) return;
      const order = new Order(
        `ord-${randomUUID().slice(0, 8)}`,
        RESTAURANT_A,
        undefined,
        [{ id: `item-${randomUUID().slice(0, 8)}`, productId: PRODUCT_ID, productName: 'ignored', unitPrice: 0, quantity: 1 }],
        'pending',
        new Date(),
        -1,
        undefined,
        'Efectivo'
      );

      // withTenantContext re-throws the raw pg error, so the RPC's
      // 'Invalid delivery fee' RAISE surfaces on the save() promise.
      await expect(repo.save(order)).rejects.toThrow(/Invalid delivery fee/);

      // The rejected insert must not leave an order row behind.
      const { rows } = await adminPool.query(`SELECT id FROM public.orders WHERE id = $1`, [order.id]);
      expect(rows.length).toBe(0);
    });

    it('grants app_user EXECUTE on the 10-arg create_order_atomic signature', async () => {
      if (!isDbConnected) return;
      // Pins the exact 10-arg signature (parameter-order contract): the SUS-19
      // idempotency replay appended p_client_order_id as the 10th arg, so the
      // old 9-arg overload is dropped and this must now resolve the 10-arg one.
      const { rows } = await adminPool.query(
        `SELECT has_function_privilege('app_user', 'public.create_order_atomic(text,text,text,text,numeric,numeric,text,jsonb,numeric,text)', 'EXECUTE') AS ok`
      );
      expect(rows[0].ok).toBe(true);
    });
  });

  describe('create_order_atomic client correlation idempotency (SUS-19)', () => {
    const makeOrder = (id: string, clientOrderId: string) =>
      new Order(
        id,
        RESTAURANT_A,
        undefined,
        [{ id: `item-${randomUUID().slice(0, 8)}`, productId: PRODUCT_ID, productName: 'ignored', unitPrice: 0, quantity: 1 }],
        'pending',
        new Date(),
        0,
        undefined,
        'Efectivo',
        undefined,
        undefined,
        undefined,
        undefined,
        clientOrderId
      );

    it('replays a save with the same (restaurant_id, client_order_id) instead of duplicating the sale', async () => {
      if (!isDbConnected) return;
      const clientOrderId = `cli-${randomUUID().slice(0, 8)}`;
      const first = makeOrder(`ord-${randomUUID().slice(0, 8)}`, clientOrderId);
      const replay = makeOrder(`ord-${randomUUID().slice(0, 8)}`, clientOrderId);

      await repo.save(first);
      const firstOrderNumber = (first as any).orderNumber;
      await repo.save(replay);

      // The replayed save carries the ORIGINAL persisted identity forward: it
      // references the first row (never a fresh phantom id), and no duplicate
      // row was inserted for the correlation id.
      expect(replay.id).toBe(first.id);
      expect(await repo.findById(replay.id, RESTAURANT_A)).not.toBeNull();
      // Exactly one row carries the correlation id — the first order, with its
      // original order_number (no double-counted counters, no new assignment).
      const { rows } = await adminPool.query(
        `SELECT id, order_number FROM public.orders WHERE restaurant_id = $1 AND client_order_id = $2`,
        [RESTAURANT_A, clientOrderId]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(first.id);
      expect(Number(rows[0].order_number)).toBe(firstOrderNumber);
    });

    it('adopts the originally persisted id on replay (SUS-19 response identity)', async () => {
      if (!isDbConnected) return;
      const clientOrderId = `cli-replay-id-${randomUUID().slice(0, 8)}`;
      const first = makeOrder(`ord-${randomUUID().slice(0, 8)}`, clientOrderId);
      const replay = makeOrder(`ord-${randomUUID().slice(0, 8)}`, clientOrderId);

      await repo.save(first);
      const firstSavedId = first.id;
      await repo.save(replay);
      await repo.save(replay);

      // The retried save must carry the ORIGINAL persisted identity forward so
      // the HTTP response returns the real order id (an offline retry adopting a
      // fresh client-generated id would reference a row that never exists).
      expect(replay.id).toBe(firstSavedId);
      expect(replay.orderNumber).toBe((first as any).orderNumber);
      const { rows } = await adminPool.query(
        `SELECT order_number FROM public.orders WHERE id = $1`,
        [firstSavedId]
      );
      expect(Number(rows[0].order_number)).toBe(replay.orderNumber);
    });

    it('creates separate rows for distinct clientOrderIds (SUS-19)', async () => {
      if (!isDbConnected) return;
      const aCid = `cli-a-${randomUUID().slice(0, 8)}`;
      const bCid = `cli-b-${randomUUID().slice(0, 8)}`;
      await repo.save(makeOrder(`ord-${randomUUID().slice(0, 8)}`, aCid));
      await repo.save(makeOrder(`ord-${randomUUID().slice(0, 8)}`, bCid));

      const { rows } = await adminPool.query(
        `SELECT count(*)::int AS n FROM public.orders WHERE restaurant_id = $1 AND client_order_id IN ($2, $3)`,
        [RESTAURANT_A, aCid, bCid]
      );
      expect(rows[0].n).toBe(2);
    });

    it('keeps NULL client_order_id flows working (legacy callers unaffected)', async () => {
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
      const found = await repo.findById(order.id, RESTAURANT_A);
      const { rows } = await adminPool.query(
        `SELECT client_order_id FROM public.orders WHERE id = $1`,
        [order.id]
      );
      expect(found).not.toBeNull();
      expect(rows[0].client_order_id).toBeNull();
    });
  });
});
