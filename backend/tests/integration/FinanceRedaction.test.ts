import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import type { Permission } from '@burger-page/contracts';
import { buildApp, buildDependencies, AppDependencies } from '../../src/infrastructure/http/app.js';
import { configureAuthMiddlewares } from '../../src/infrastructure/http/middleware/auth.middleware.js';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';
import { ID_PREFIX, newId } from '../../src/domain/shared/newId.js';

// TASK-06: money that is not needed to run orders is redacted server-side for
// users without finance.view. Per-order amounts stay (tickets, collecting
// payment); cost data and every aggregate/report endpoint do not.
describe('Server-side finance redaction (finance.view)', () => {
  let app: FastifyInstance;
  let deps: AppDependencies;
  const jwt = new JwtService();
  const auth = (token: string) => ({ authorization: `Bearer ${token}` });
  const TENANT = 'burger-craft';

  const adminToken = jwt.generateToken({ id: 'user-admin-craft', username: 'admin_craft', role: 'restaurant_admin', restaurantId: TENANT });
  const superToken = jwt.generateToken({ id: 'user-superadmin', username: 'admin', role: 'super_admin' });
  let seq = 0;

  async function staffToken(permissions: Permission[]) {
    const roleId = newId(ID_PREFIX.role);
    const now = new Date().toISOString();
    await deps.roleRepo.save({ id: roleId, restaurantId: TENANT, name: `r${++seq}`, permissions, isSystem: false, createdAt: now, updatedAt: now });
    const id = newId(ID_PREFIX.user);
    await deps.userRepo.save({ id, username: `s${seq}`, passwordHash: 'x', role: 'restaurant_staff', restaurantId: TENANT, roleId, createdAt: now, isActive: true });
    return jwt.generateToken({ id, username: `s${seq}`, role: 'restaurant_staff', restaurantId: TENANT });
  }

  let itemId: string;
  let noFinance: string;
  let withFinance: string;

  beforeAll(async () => {
    deps = buildDependencies(undefined, 'memory');
    configureAuthMiddlewares({ userRepo: deps.userRepo, restaurantRepo: deps.restaurantRepo, roleRepo: deps.roleRepo });
    app = buildApp(deps);
    await app.ready();
    noFinance = await staffToken(['inventory.manage', 'orders.view', 'orders.manage', 'customers.view']);
    withFinance = await staffToken(['inventory.manage', 'finance.view']);
    const created = await app.inject({
      method: 'POST', url: '/api/inventory', headers: auth(adminToken),
      payload: { name: 'Pan brioche', category: 'ingredients', unit: 'unidades', quantity: 10, costPerUnit: 1200 },
    });
    expect(created.statusCode).toBe(201);
    itemId = created.json().id;
  });

  afterAll(async () => {
    await app.close();
    configureAuthMiddlewares({});
  });

  describe('inventory costPerUnit', () => {
    it('admins and finance.view users still see the cost', async () => {
      for (const token of [adminToken, withFinance, superToken]) {
        const res = await app.inject({ method: 'GET', url: `/api/inventory/${itemId}?restaurantId=${TENANT}`, headers: auth(token) });
        expect(res.statusCode).toBe(200);
        expect(res.json().costPerUnit).toBe(1200);
      }
    });

    it('is omitted from the list and detail for staff without finance.view', async () => {
      const list = await app.inject({ method: 'GET', url: '/api/inventory', headers: auth(noFinance) });
      expect(list.statusCode).toBe(200);
      const items = list.json() as Array<Record<string, unknown>>;
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) expect('costPerUnit' in item).toBe(false);
      // stock data needed to run the kitchen is still there
      expect(items.find((i) => i.id === itemId)).toMatchObject({ name: 'Pan brioche', quantity: 10 });

      const detail = await app.inject({ method: 'GET', url: `/api/inventory/${itemId}`, headers: auth(noFinance) });
      expect('costPerUnit' in detail.json()).toBe(false);
    });

    it('is omitted from paginated lists too', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/inventory?page=1&limit=10', headers: auth(noFinance) });
      expect(res.statusCode).toBe(200);
      for (const item of res.json() as Array<Record<string, unknown>>) expect('costPerUnit' in item).toBe(false);
    });

    it('cannot be written without finance.view: create ignores it, update keeps the stored cost, and neither echoes it', async () => {
      const created = await app.inject({
        method: 'POST', url: '/api/inventory', headers: auth(noFinance),
        payload: { name: 'Queso', category: 'ingredients', unit: 'kg', costPerUnit: 99999 },
      });
      expect(created.statusCode).toBe(201);
      expect('costPerUnit' in created.json()).toBe(false);
      const createdAsAdmin = await app.inject({ method: 'GET', url: `/api/inventory/${created.json().id}`, headers: auth(adminToken) });
      expect(createdAsAdmin.json().costPerUnit).toBe(0);

      const updated = await app.inject({
        method: 'PUT', url: `/api/inventory/${itemId}`, headers: auth(noFinance),
        payload: { name: 'Pan brioche XL', costPerUnit: 1 },
      });
      expect(updated.statusCode).toBe(200);
      expect('costPerUnit' in updated.json()).toBe(false);
      const stored = await app.inject({ method: 'GET', url: `/api/inventory/${itemId}`, headers: auth(adminToken) });
      expect(stored.json()).toMatchObject({ name: 'Pan brioche XL', costPerUnit: 1200 });
    });

    it('finance.view users can still change the cost', async () => {
      const res = await app.inject({ method: 'PUT', url: `/api/inventory/${itemId}`, headers: auth(withFinance), payload: { costPerUnit: 1500 } });
      expect(res.statusCode).toBe(200);
      expect(res.json().costPerUnit).toBe(1500);
    });
  });

  describe('orders keep per-order amounts for staff', () => {
    it('order list and detail still carry subtotal/finalTotal/payment so staff can run and print orders', async () => {
      const product = await app.inject({
        method: 'POST', url: '/api/products', headers: auth(adminToken),
        payload: { name: 'Smash', description: 'x', price: 22000, categoryId: 'cat-1', category: 'Burgers', isAvailable: true, additions: [] },
      });
      const order = await app.inject({
        method: 'POST', url: '/api/orders',
        payload: { restaurantId: TENANT, customerId: 'cust-1', items: [{ productId: product.json().id, quantity: 2, additions: [] }] },
      });
      expect(order.statusCode).toBe(201);

      const list = await app.inject({ method: 'GET', url: '/api/orders', headers: auth(noFinance) });
      const found = (list.json() as Array<Record<string, any>>).find((o) => o.id === order.json().id)!;
      expect(found.subtotal).toBe(44000);
      expect(found.finalTotal).toBeGreaterThanOrEqual(44000);

      const detail = await app.inject({ method: 'GET', url: `/api/orders/${found.id}`, headers: auth(noFinance) });
      expect(detail.json().finalTotal).toBe(found.finalTotal);
    });
  });

  describe('customers expose no spend aggregates', () => {
    it('customer list/detail contain no financial fields for anyone (aggregates are derived client-side from orders)', async () => {
      const created = await app.inject({
        method: 'POST', url: '/api/customers', headers: auth(adminToken), payload: { name: 'Ana', phone: '3001234567' },
      });
      expect(created.statusCode).toBe(201);
      const staff = await staffToken(['customers.view']);
      const list = await app.inject({ method: 'GET', url: '/api/customers', headers: auth(staff) });
      expect(list.statusCode).toBe(200);
      const money = /spent|revenue|total|spend|ltv|ticket|balance/i;
      for (const c of list.json() as Array<Record<string, unknown>>) {
        expect(Object.keys(c).filter((k) => money.test(k))).toEqual([]);
      }
    });
  });

  describe('report-like endpoints stay out of reach', () => {
    it('platform stats and the audit log are super_admin only (staff and tenant admins get 403)', async () => {
      const staff = await staffToken(['finance.view']);
      for (const token of [staff, adminToken]) {
        expect((await app.inject({ method: 'GET', url: '/api/platform-stats', headers: auth(token) })).statusCode).toBe(403);
        expect((await app.inject({ method: 'GET', url: '/api/audit-log', headers: auth(token) })).statusCode).toBe(403);
      }
    });
  });
});
