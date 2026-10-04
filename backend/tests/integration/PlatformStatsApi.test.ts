import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { platformStatsSchema } from '@burger-page/contracts';
import { buildApp } from '../../src/infrastructure/http/app.js';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';
import { PlatformStatsController } from '../../src/infrastructure/http/controllers/PlatformStatsController.js';
import { GetPlatformStatsUseCase } from '../../src/application/use-cases/GetPlatformStatsUseCase.js';
import type { PlatformStatsRepository } from '../../src/domain/ports/out/PlatformStatsRepository.js';

const jwt = new JwtService();
const superToken = jwt.generateToken({ id: 'user-superadmin', username: 'admin', role: 'super_admin' });
const tenantToken = jwt.generateToken({ id: 'user-admin-craft', username: 'admin_craft', role: 'restaurant_admin', restaurantId: 'burger-craft' });
const auth = (token: string) => ({ authorization: `Bearer ${token}` });

const STATS = { totalRevenue: 1234.5, totalOrders: 9, cancelledOrders: 2, totalCustomers: 4, totalRestaurants: 3, activeRestaurants: 2 };

describe('GET /api/platform-stats (stubbed repository)', () => {
  let app: FastifyInstance;
  let get: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    get = vi.fn().mockResolvedValue(STATS);
    const repo: PlatformStatsRepository = { get };
    app = buildApp({ platformStatsController: new PlatformStatsController(new GetPlatformStatsUseCase(repo)) });
    await app.ready();
  });
  afterEach(async () => {
    await app.close();
  });

  const getStats = (qs = '', token?: string) =>
    app.inject({ method: 'GET', url: `/api/platform-stats${qs}`, headers: token ? auth(token) : undefined });

  it('is 401 for anonymous callers and never reads storage', async () => {
    const res = await getStats();
    expect(res.statusCode).toBe(401);
    expect(get).not.toHaveBeenCalled();
  });

  it('is 403 for a restaurant admin and never reads storage', async () => {
    const res = await getStats('', tenantToken);
    expect(res.statusCode).toBe(403);
    expect(get).not.toHaveBeenCalled();
  });

  it('returns the five totals to the super admin, matching the shared contract', async () => {
    const res = await getStats('', superToken);
    expect(res.statusCode).toBe(200);
    expect(platformStatsSchema.parse(res.json())).toEqual(STATS);
    expect(get).toHaveBeenCalledWith({});
  });

  it('turns from/to calendar days into a half-open orders window', async () => {
    const res = await getStats('?from=2026-01-01&to=2026-01-31', superToken);
    expect(res.statusCode).toBe(200);
    expect(get).toHaveBeenCalledWith({
      ordersFrom: '2026-01-01T00:00:00.000Z',
      ordersBefore: '2026-02-01T00:00:00.000Z',
    });
  });

  it.each([
    ['not a date', '?from=yesterday'],
    ['wrong format', '?to=2026-1-5'],
    ['impossible day', '?to=2026-02-30'],
    ['reversed range', '?from=2026-02-01&to=2026-01-31'],
  ])('is 400 for an invalid range (%s) and never reads storage', async (_label, qs) => {
    const res = await getStats(qs, superToken);
    expect(res.statusCode).toBe(400);
    expect(get).not.toHaveBeenCalled();
  });

  it('is read-only: no write verb is routed', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) {
      const res = await app.inject({ method, url: '/api/platform-stats', headers: auth(superToken) });
      expect(res.statusCode).toBe(404);
    }
  });
});

describe('GET /api/platform-stats (real memory-driver wiring)', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = buildApp();
    await app.ready();
  });
  afterEach(async () => {
    await app.close();
  });

  const stats = async () => {
    const res = await app.inject({ method: 'GET', url: '/api/platform-stats', headers: auth(superToken) });
    expect(res.statusCode).toBe(200);
    return platformStatsSchema.parse(res.json());
  };

  it('counts the seeded restaurants and excludes a restaurant once it is soft-deleted', async () => {
    const listed = (await app.inject({ method: 'GET', url: '/api/restaurants', headers: auth(superToken) })).json();
    const before = await stats();
    expect(before.totalRestaurants).toBe(listed.length);
    expect(before.activeRestaurants).toBe(listed.filter((r: any) => r.isActive).length);

    const created = await app.inject({
      method: 'POST',
      url: '/api/restaurants',
      headers: auth(superToken),
      payload: { name: 'Stats Probe', slug: 'stats-probe', adminPassword: 'probe-password-1' },
    });
    expect(created.statusCode).toBe(201);
    const after = await stats();
    expect(after.totalRestaurants).toBe(before.totalRestaurants + 1);
    expect(after.activeRestaurants).toBe(before.activeRestaurants + 1);

    const removed = await app.inject({ method: 'DELETE', url: `/api/restaurants/${created.json().id}`, headers: auth(superToken) });
    expect(removed.statusCode).toBe(200);
    expect(await stats()).toEqual(before);
  });

  it('adds a new order to totalOrders and its total to revenue', async () => {
    const tenantAuth = auth(tenantToken);
    const product = (
      await app.inject({
        method: 'POST',
        url: '/api/products',
        headers: tenantAuth,
        payload: { name: 'Stats Burger', price: 10, description: 'x', categoryId: 'cat-1', category: 'Burgers', isAvailable: true, additions: [] },
      })
    ).json();
    const before = await stats();
    const order = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: { restaurantId: 'burger-craft', items: [{ productId: product.id, quantity: 2, additions: [] }], paymentMethod: 'Efectivo', paymentAmount: 100 },
    });
    expect(order.statusCode).toBe(201);
    const after = await stats();
    expect(after.totalOrders).toBe(before.totalOrders + 1);
    expect(after.totalRevenue - before.totalRevenue).toBeCloseTo(order.json().finalTotal, 2);
  });

  it('moves a cancelled order out of totalOrders and revenue into cancelledOrders', async () => {
    const tenantAuth = auth(tenantToken);
    const product = (
      await app.inject({
        method: 'POST',
        url: '/api/products',
        headers: tenantAuth,
        payload: { name: 'Cancel Burger', price: 10, description: 'x', categoryId: 'cat-1', category: 'Burgers', isAvailable: true, additions: [] },
      })
    ).json();
    const order = (
      await app.inject({
        method: 'POST',
        url: '/api/orders',
        payload: { restaurantId: 'burger-craft', items: [{ productId: product.id, quantity: 1, additions: [] }], paymentMethod: 'Efectivo', paymentAmount: 100 },
      })
    ).json();
    const placed = await stats();

    const cancelled = await app.inject({ method: 'PATCH', url: `/api/orders/${order.id}/status`, headers: tenantAuth, payload: { status: 'cancelled' } });
    expect(cancelled.statusCode).toBe(200);
    const after = await stats();
    expect(after.totalOrders).toBe(placed.totalOrders - 1);
    expect(after.cancelledOrders).toBe(placed.cancelledOrders + 1);
    expect(placed.totalRevenue - after.totalRevenue).toBeCloseTo(order.finalTotal, 2);
  });

  it('narrows the orders to a date range: a window in the past sees none of today\'s orders', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/platform-stats?from=2000-01-01&to=2000-12-31', headers: auth(superToken) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ totalOrders: 0, cancelledOrders: 0, totalRevenue: 0 });
    // restaurant totals are not touched by the range
    expect(res.json().totalRestaurants).toBe((await stats()).totalRestaurants);
  });
});
