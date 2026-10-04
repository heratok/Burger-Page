import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { PgPlatformStatsRepository } from '../../../src/infrastructure/persistence/postgres/PgPlatformStatsRepository.js';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/burger_page_test';
const APP_USER_DATABASE_URL =
  process.env.APP_USER_DATABASE_URL || 'postgres://app_user:app_user_test_only@localhost:5432/burger_page_test';

let isDbConnected = false;

describe('PgPlatformStatsRepository (real Postgres, app_user role under RLS)', () => {
  let adminPool: pg.Pool;
  let repo: PgPlatformStatsRepository;
  const RUN = randomUUID().slice(0, 8);
  const LIVE = `stats-live-${RUN}`;
  const INACTIVE = `stats-inactive-${RUN}`;
  const DELETED = `stats-deleted-${RUN}`;

  // A window nobody else writes to, so range assertions are exact even though
  // the database holds other tenants' data.
  const WINDOW = { ordersFrom: '1999-06-01T00:00:00.000Z', ordersBefore: '1999-07-01T00:00:00.000Z' };

  let orderSeq = 0;
  async function order(restaurantId: string, status: string, amount: number, createdAt: string) {
    await adminPool.query(
      `INSERT INTO public.orders (id, restaurant_id, status, subtotal, delivery_fee, final_total, created_at)
       VALUES ($1, $2, $3, $4, 0, $4, $5::timestamptz)`,
      [`stats-ord-${RUN}-${++orderSeq}`, restaurantId, status, amount, createdAt]
    );
  }
  async function customer(restaurantId: string, n: number) {
    await adminPool.query(
      `INSERT INTO public.customers (id, restaurant_id, name, phone) VALUES ($1, $2, $3, $4)`,
      [`stats-cus-${RUN}-${restaurantId}-${n}`.slice(0, 64), restaurantId, `Cliente ${n}`, `300${n}${RUN}`]
    );
  }

  let baseline: Awaited<ReturnType<PgPlatformStatsRepository['get']>>;

  beforeAll(async () => {
    process.env.DATABASE_URL = APP_USER_DATABASE_URL;
    adminPool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2000 });
    try {
      await adminPool.query('SELECT 1');
      isDbConnected = true;
    } catch (err: any) {
      console.warn(`\n[PgPlatformStatsRepository] Skipping: cannot connect (${err.message}).`);
      return;
    }
    repo = new PgPlatformStatsRepository();
    baseline = await repo.get({});

    await adminPool.query(
      `INSERT INTO public.restaurants (id, slug, name, is_active, deleted_at, deleted_slug) VALUES
         ($1, $1, 'Live', TRUE,  NULL, NULL),
         ($2, $2, 'Inactive', FALSE, NULL, NULL),
         ($3, $3, 'Deleted', TRUE,  NOW(), $3)`,
      [LIVE, INACTIVE, DELETED]
    );
    await customer(LIVE, 1);
    await customer(LIVE, 2);
    await customer(INACTIVE, 1);
    for (const n of [1, 2, 3]) await customer(DELETED, n);

    // Inside the window.
    await order(LIVE, 'delivered', 100, '1999-06-15T12:00:00Z');
    await order(LIVE, 'pending', 50, '1999-06-16T12:00:00Z');
    await order(LIVE, 'cancelled', 999, '1999-06-17T12:00:00Z');
    await order(INACTIVE, 'delivered', 25, '1999-06-18T12:00:00Z');
    // Exactly on the inclusive lower bound / last millisecond of the window.
    await order(LIVE, 'delivered', 10, '1999-06-01T00:00:00.000Z');
    await order(LIVE, 'delivered', 5, '1999-06-30T23:59:59.999Z');
    // Exactly on the exclusive upper bound, and after the window.
    await order(LIVE, 'delivered', 20, '1999-07-01T00:00:00.000Z');
    await order(LIVE, 'delivered', 1000, '2000-01-01T00:00:00Z');
    // A deleted restaurant's orders never count.
    await order(DELETED, 'delivered', 7777, '1999-06-15T12:00:00Z');
  });

  afterAll(async () => {
    if (isDbConnected) {
      const ids = [LIVE, INACTIVE, DELETED];
      await adminPool.query(`DELETE FROM public.orders WHERE restaurant_id = ANY($1)`, [ids]);
      await adminPool.query(`DELETE FROM public.customers WHERE restaurant_id = ANY($1)`, [ids]);
      await adminPool.query(`DELETE FROM public.restaurants WHERE id = ANY($1)`, [ids]);
    }
    await adminPool?.end();
  });

  it('sums non-cancelled revenue and counts every order of live restaurants inside the window', async () => {
    if (!isDbConnected) return;
    const stats = await repo.get(WINDOW);
    // delivered 100 + pending 50 + inactive 25 + lower-bound 10 + last-ms 5; cancelled 999,
    // the exclusive upper bound, the later order and the deleted restaurant's order are out.
    expect(stats.totalRevenue).toBeCloseTo(190, 2);
    // those 5 + the cancelled one (cancelled orders are counted, only their money is not)
    expect(stats.totalOrders).toBe(6);
  });

  it('returns numbers, not Postgres numeric/bigint strings', async () => {
    if (!isDbConnected) return;
    const stats = await repo.get(WINDOW);
    for (const value of Object.values(stats)) expect(typeof value).toBe('number');
  });

  it('is zero revenue and zero orders for a window with no orders', async () => {
    if (!isDbConnected) return;
    const stats = await repo.get({ ordersFrom: '1980-01-01T00:00:00.000Z', ordersBefore: '1980-01-02T00:00:00.000Z' });
    expect(stats.totalRevenue).toBe(0);
    expect(stats.totalOrders).toBe(0);
  });

  it('supports an open-ended window on either side', async () => {
    if (!isDbConnected) return;
    // Nothing else in the database predates 1999, so a lower-unbounded window is exact.
    const beforeOnly = await repo.get({ ordersBefore: '1999-07-01T00:00:00.000Z' });
    expect(beforeOnly.totalRevenue).toBeCloseTo(190, 2);
    expect(beforeOnly.totalOrders).toBe(6);
    // Upper-unbounded: the difference between two lower bounds isolates my two later orders (20 and 1000).
    const fromJuly99 = await repo.get({ ordersFrom: '1999-07-01T00:00:00.000Z' });
    const fromJan00After = await repo.get({ ordersFrom: '2000-01-02T00:00:00.000Z' });
    expect(fromJuly99.totalOrders - fromJan00After.totalOrders).toBe(2);
    expect(fromJuly99.totalRevenue - fromJan00After.totalRevenue).toBeCloseTo(1020, 2);
  });

  it('excludes soft-deleted restaurants and their customers from every total (deltas over the existing data)', async () => {
    if (!isDbConnected) return;
    const after = await repo.get({});
    // live + inactive are new; the deleted one is not counted at all.
    expect(after.totalRestaurants - baseline.totalRestaurants).toBe(2);
    // only the live one is active.
    expect(after.activeRestaurants - baseline.activeRestaurants).toBe(1);
    // 2 + 1 customers; the deleted restaurant's 3 are excluded.
    expect(after.totalCustomers - baseline.totalCustomers).toBe(3);
    // 8 orders of live restaurants (cancelled included); the deleted one's is excluded.
    expect(after.totalOrders - baseline.totalOrders).toBe(8);
    // 100+50+25+10+5+20+1000 = 1210; cancelled 999 and deleted 7777 excluded.
    expect(after.totalRevenue - baseline.totalRevenue).toBeCloseTo(1210, 2);
  });

  it('does not let the range filter touch restaurant or customer totals', async () => {
    if (!isDbConnected) return;
    const all = await repo.get({});
    const windowed = await repo.get(WINDOW);
    expect(windowed.totalRestaurants).toBe(all.totalRestaurants);
    expect(windowed.activeRestaurants).toBe(all.activeRestaurants);
    expect(windowed.totalCustomers).toBe(all.totalCustomers);
  });

  it('keeps counting a restaurant once it is soft-deleted and stops when it is (delta)', async () => {
    if (!isDbConnected) return;
    const before = await repo.get({});
    await adminPool.query(`UPDATE public.restaurants SET deleted_at = NOW(), deleted_slug = slug WHERE id = $1`, [INACTIVE]);
    try {
      const after = await repo.get({});
      expect(before.totalRestaurants - after.totalRestaurants).toBe(1);
      expect(before.totalCustomers - after.totalCustomers).toBe(1);
      expect(before.totalOrders - after.totalOrders).toBe(1);
      expect(before.totalRevenue - after.totalRevenue).toBeCloseTo(25, 2);
    } finally {
      await adminPool.query(`UPDATE public.restaurants SET deleted_at = NULL, deleted_slug = NULL WHERE id = $1`, [INACTIVE]);
    }
  });
});
