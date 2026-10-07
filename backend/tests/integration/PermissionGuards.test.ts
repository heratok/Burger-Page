import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { FastifyInstance } from 'fastify';
import type { Permission } from '@burger-page/contracts';
import { buildApp, buildDependencies, AppDependencies } from '../../src/infrastructure/http/app.js';
import { configureAuthMiddlewares } from '../../src/infrastructure/http/middleware/auth.middleware.js';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';
import { ID_PREFIX, newId } from '../../src/domain/shared/newId.js';

// Route-level RBAC (TASK-05): staff only reach what their role grants, resolved
// from storage on every request. Revalidation is switched on explicitly because
// buildApp skips it under vitest.
describe('Permission guards on tenant routes', () => {
  let app: FastifyInstance;
  let deps: AppDependencies;
  const jwt = new JwtService();
  const auth = (token: string) => ({ authorization: `Bearer ${token}` });
  const TENANT = 'burger-craft';
  const OTHER_TENANT = 'rest_e2e_fixture';

  const staffTokens = new Map<string, string>();
  const staffIds = new Map<string, string>();
  const roleIds = new Map<string, string>();

  async function makeRole(key: string, permissions: Permission[], restaurantId = TENANT) {
    const id = newId(ID_PREFIX.role);
    const now = new Date().toISOString();
    await deps.roleRepo.save({ id, restaurantId, name: `role-${key}`, permissions, isSystem: false, createdAt: now, updatedAt: now });
    roleIds.set(key, id);
    return id;
  }

  async function makeStaff(key: string, roleId: string, restaurantId = TENANT) {
    const id = newId(ID_PREFIX.user);
    await deps.userRepo.save({
      id,
      username: `staff_${key}`,
      passwordHash: 'x',
      role: 'restaurant_staff',
      restaurantId,
      roleId,
      createdAt: new Date().toISOString(),
      isActive: true,
    });
    staffIds.set(key, id);
    staffTokens.set(
      key,
      jwt.generateToken({ id, username: `staff_${key}`, role: 'restaurant_staff', restaurantId })
    );
  }

  const adminToken = jwt.generateToken({ id: 'user-admin-craft', username: 'admin_craft', role: 'restaurant_admin', restaurantId: TENANT });
  const superToken = jwt.generateToken({ id: 'user-superadmin', username: 'admin', role: 'super_admin' });

  beforeAll(async () => {
    deps = buildDependencies(undefined, 'memory');
    configureAuthMiddlewares({ userRepo: deps.userRepo, restaurantRepo: deps.restaurantRepo, roleRepo: deps.roleRepo });
    app = buildApp(deps);
    await app.ready();

    await makeStaff('none', await makeRole('none', []));
    await makeStaff('ordersView', await makeRole('ordersView', ['orders.view']));
    await makeStaff('ordersManage', await makeRole('ordersManage', ['orders.manage']));
    await makeStaff('ordersDelete', await makeRole('ordersDelete', ['orders.delete']));
    await makeStaff('customersView', await makeRole('customersView', ['customers.view']));
    await makeStaff('customersManage', await makeRole('customersManage', ['customers.manage']));
    await makeStaff('menu', await makeRole('menu', ['menu.manage']));
    await makeStaff('inventory', await makeRole('inventory', ['inventory.manage']));
    await makeStaff('tables', await makeRole('tables', ['tables.manage']));
    await makeStaff('settings', await makeRole('settings', ['settings.manage']));
    await makeStaff('users', await makeRole('users', ['users.manage']));
    await makeStaff('roles', await makeRole('roles', ['roles.manage']));
    await makeStaff('finance', await makeRole('finance', ['finance.view']));
  });

  afterAll(async () => {
    await app.close();
    configureAuthMiddlewares({});
  });

  type Case = {
    name: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    url: string;
    payload?: Record<string, unknown>;
    /** Staff keys that must be let through (not 401/403). Everyone else must get 403. */
    allowed: string[];
  };

  const READ_ORDERS = ['ordersView', 'ordersManage'];
  const cases: Case[] = [
    { name: 'list orders', method: 'GET', url: '/api/orders', allowed: READ_ORDERS },
    { name: 'order detail', method: 'GET', url: '/api/orders/ord_missing', allowed: READ_ORDERS },
    { name: 'stream token', method: 'POST', url: '/api/orders/stream-token', allowed: READ_ORDERS },
    { name: 'order status', method: 'PATCH', url: '/api/orders/ord_missing/status', payload: { status: 'cooking' }, allowed: ['ordersManage'] },
    { name: 'order receipt', method: 'PATCH', url: '/api/orders/ord_missing/receipt', payload: { receiptUrl: 'https://x.test/r.png' }, allowed: ['ordersManage'] },
    { name: 'order edit', method: 'PUT', url: '/api/orders/ord_missing', payload: { comment: 'x' }, allowed: ['ordersManage'] },
    { name: 'order delete', method: 'DELETE', url: '/api/orders/ord_missing', allowed: ['ordersDelete'] },

    { name: 'list customers', method: 'GET', url: '/api/customers', allowed: ['customersView', 'customersManage'] },
    { name: 'customer detail', method: 'GET', url: '/api/customers/cust_missing', allowed: ['customersView', 'customersManage'] },
    { name: 'create customer', method: 'POST', url: '/api/customers', payload: { name: 'A', phone: '3001112233' }, allowed: ['customersManage'] },
    { name: 'update customer', method: 'PUT', url: '/api/customers/cust_missing', payload: { name: 'B' }, allowed: ['customersManage'] },
    { name: 'delete customer', method: 'DELETE', url: '/api/customers/cust_missing', allowed: ['customersManage'] },

    { name: 'create product', method: 'POST', url: '/api/products', payload: { name: 'P', price: 1000, category: 'Burgers' }, allowed: ['menu'] },
    { name: 'update product', method: 'PUT', url: '/api/products/prod_missing', payload: { name: 'P' }, allowed: ['menu'] },
    { name: 'delete product', method: 'DELETE', url: '/api/products/prod_missing', allowed: ['menu'] },
    { name: 'create addition', method: 'POST', url: '/api/additions', payload: { name: 'A', price: 500 }, allowed: ['menu'] },
    { name: 'update addition', method: 'PUT', url: '/api/additions/add_missing', payload: { name: 'A' }, allowed: ['menu'] },
    { name: 'delete addition', method: 'DELETE', url: '/api/additions/add_missing', allowed: ['menu'] },
    { name: 'save categories', method: 'PUT', url: '/api/restaurant/categories', payload: { categories: ['Burgers'] }, allowed: ['menu'] },
    { name: 'list suppliers', method: 'GET', url: '/api/suppliers', allowed: ['menu'] },
    { name: 'create supplier', method: 'POST', url: '/api/suppliers', payload: { name: 'S', category: 'x', contactName: 'c', phone: '1' }, allowed: ['menu'] },
    { name: 'update supplier', method: 'PUT', url: '/api/suppliers/sup_missing', payload: { name: 'S' }, allowed: ['menu'] },
    { name: 'delete supplier', method: 'DELETE', url: '/api/suppliers/sup_missing', allowed: ['menu'] },

    { name: 'list inventory', method: 'GET', url: '/api/inventory', allowed: ['inventory'] },
    { name: 'inventory detail', method: 'GET', url: '/api/inventory/inv_missing', allowed: ['inventory'] },
    { name: 'create inventory', method: 'POST', url: '/api/inventory', payload: { name: 'I', category: 'other', unit: 'kg' }, allowed: ['inventory'] },
    { name: 'update inventory', method: 'PUT', url: '/api/inventory/inv_missing', payload: { name: 'I' }, allowed: ['inventory'] },
    { name: 'adjust stock', method: 'PATCH', url: '/api/inventory/inv_missing/stock', payload: { quantityChange: 1 }, allowed: ['inventory'] },
    { name: 'delete inventory', method: 'DELETE', url: '/api/inventory/inv_missing', allowed: ['inventory'] },

    { name: 'list tables', method: 'GET', url: '/api/tables', allowed: ['tables', 'ordersView', 'ordersManage'] },
    { name: 'create table', method: 'POST', url: '/api/tables', payload: { name: 'Mesa 99' }, allowed: ['tables'] },
    { name: 'reorder tables', method: 'PUT', url: '/api/tables/order', payload: { ids: [] }, allowed: ['tables'] },
    { name: 'update table', method: 'PUT', url: '/api/tables/tbl_missing', payload: { name: 'M' }, allowed: ['tables'] },
    { name: 'delete table', method: 'DELETE', url: '/api/tables/tbl_missing', allowed: ['tables'] },

    { name: 'update restaurant settings', method: 'PUT', url: `/api/restaurants/${TENANT}`, payload: { tagline: 'hi' }, allowed: ['settings'] },
    { name: 'upload url (branding)', method: 'POST', url: '/api/storage/upload-url', payload: { folder: 'branding', filename: 'a.png' }, allowed: ['settings', 'menu'] },

    { name: 'list users', method: 'GET', url: '/api/users', allowed: ['users'] },
    // User/role management delegation (writes) is covered in StaffUsersApi.test.ts.
  ];

  describe.each(cases)('$method $url ($name)', (c) => {
    it('rejects staff holding none of the required permissions with 403', async () => {
      for (const key of staffTokens.keys()) {
        if (c.allowed.includes(key)) continue;
        const res = await app.inject({ method: c.method, url: c.url, headers: auth(staffTokens.get(key)!), payload: c.payload });
        expect(res.statusCode, `${key} -> ${c.method} ${c.url}`).toBe(403);
      }
    });

    it('lets staff with the right permission through (never 401/403)', async () => {
      for (const key of c.allowed) {
        const res = await app.inject({ method: c.method, url: c.url, headers: auth(staffTokens.get(key)!), payload: c.payload });
        expect([401, 403], `${key} -> ${c.method} ${c.url} got ${res.statusCode}`).not.toContain(res.statusCode);
      }
    });
  });

  describe('administrators keep everything they had', () => {
    it.each(cases)(
      'restaurant_admin is never 401/403 on $method $url',
      async (c) => {
        const asAdmin = await app.inject({ method: c.method, url: c.url, headers: auth(adminToken), payload: c.payload });
        expect(asAdmin.statusCode).not.toBe(403);
        expect(asAdmin.statusCode).not.toBe(401);
      }
    );

    it('super_admin is not 403 on tenant routes', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/orders?restaurantId=${TENANT}`, headers: auth(superToken) });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('storefront reads stay public', () => {
    it('a staff with no permissions can still read the public menu and restaurant', async () => {
      const products = await app.inject({ method: 'GET', url: `/api/products?restaurantId=${TENANT}`, headers: auth(staffTokens.get('none')!) });
      expect(products.statusCode).toBe(200);
      const restaurant = await app.inject({ method: 'GET', url: `/api/restaurant/${TENANT}`, headers: auth(staffTokens.get('none')!) });
      expect(restaurant.statusCode).toBe(200);
    });
  });

  describe('permissions are re-read from storage on every request', () => {
    it('revoking a permission from the role takes effect immediately', async () => {
      const roleId = await makeRole('temp', ['orders.view']);
      await makeStaff('temp', roleId);
      const token = staffTokens.get('temp')!;
      expect((await app.inject({ method: 'GET', url: '/api/orders', headers: auth(token) })).statusCode).toBe(200);

      const role = (await deps.roleRepo.findById(roleId, TENANT))!;
      await deps.roleRepo.save({ ...role, permissions: [] });
      expect((await app.inject({ method: 'GET', url: '/api/orders', headers: auth(token) })).statusCode).toBe(403);
    });

    it('a deleted role leaves no stale access', async () => {
      const roleId = await makeRole('gone', ['orders.view']);
      await makeStaff('gone', roleId);
      const token = staffTokens.get('gone')!;
      expect((await app.inject({ method: 'GET', url: '/api/orders', headers: auth(token) })).statusCode).toBe(200);
      await deps.roleRepo.delete(roleId, TENANT);
      expect((await app.inject({ method: 'GET', url: '/api/orders', headers: auth(token) })).statusCode).toBe(403);
    });

    it('a deactivated staff user is rejected with 401', async () => {
      const roleId = await makeRole('off', ['orders.view']);
      await makeStaff('off', roleId);
      const token = staffTokens.get('off')!;
      const user = (await deps.userRepo.findById(staffIds.get('off')!))!;
      await deps.userRepo.save({ ...user, isActive: false });
      expect((await app.inject({ method: 'GET', url: '/api/orders', headers: auth(token) })).statusCode).toBe(401);
    });

    it('a staff user whose role belongs to another restaurant gets no permissions', async () => {
      const foreignRole = await makeRole('foreign', ['orders.view', 'orders.manage'], OTHER_TENANT);
      await makeStaff('foreignHolder', foreignRole);
      const res = await app.inject({ method: 'GET', url: '/api/orders', headers: auth(staffTokens.get('foreignHolder')!) });
      expect(res.statusCode).toBe(403);
    });

    it('a claim of restaurant_admin in the token cannot outrank the stored staff row', async () => {
      const forged = jwt.generateToken({ id: staffIds.get('none')!, username: 'staff_none', role: 'restaurant_admin', restaurantId: TENANT });
      const res = await app.inject({ method: 'GET', url: '/api/inventory', headers: auth(forged) });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('tenant isolation', () => {
    it('a staff user only sees orders of their own restaurant even when asking for another', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/orders?restaurantId=${OTHER_TENANT}`,
        headers: auth(staffTokens.get('ordersView')!),
      });
      expect(res.statusCode).toBe(200);
      for (const o of res.json() as Array<{ restaurantId: string }>) {
        expect(o.restaurantId).toBe(TENANT);
      }
    });

    it('a staff user cannot edit another restaurant through the settings route', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/restaurants/${OTHER_TENANT}`,
        headers: auth(staffTokens.get('settings')!),
        payload: { tagline: 'hijack' },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('manual order creation privileges', () => {
    it('staff without orders.manage creating an order degrades to a public guest (no staff privileges)', async () => {
      // Public POST stays open; the staff privilege flag requires orders.manage.
      const res = await app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: auth(staffTokens.get('ordersView')!),
        payload: { restaurantId: TENANT, items: [] },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('SSE stream', () => {
    function openStream(token: string): Promise<number> {
      return new Promise((resolve, reject) => {
        const address = app.server.address();
        if (!address || typeof address === 'string') return reject(new Error('no address'));
        const req = http.get(
          { host: '127.0.0.1', port: address.port, path: '/api/orders/stream', headers: { authorization: `Bearer ${token}` } },
          (res) => {
            const status = res.statusCode ?? 0;
            res.destroy();
            resolve(status);
          }
        );
        req.on('error', (e) => {
          if ((e as NodeJS.ErrnoException).code === 'ECONNRESET') return;
          reject(e);
        });
      });
    }

    beforeAll(async () => {
      await app.listen({ port: 0, host: '127.0.0.1' });
    });

    it('streams for staff holding orders.view', async () => {
      expect(await openStream(staffTokens.get('ordersView')!)).toBe(200);
    });

    it('refuses staff without any orders permission', async () => {
      expect(await openStream(staffTokens.get('none')!)).toBe(403);
    });
  });

  describe('login and session payloads expose the resolved permissions', () => {
    it('GET /api/users/me returns the stored permissions for staff', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/users/me', headers: auth(staffTokens.get('ordersView')!) });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.role).toBe('restaurant_staff');
      expect(body.permissions).toEqual(['orders.view']);
      expect(body.roleId).toBe(roleIds.get('ordersView'));
    });

    it('GET /api/users/me gives administrators the full catalog', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/users/me', headers: auth(adminToken) });
      expect(res.statusCode).toBe(200);
      expect(res.json().permissions).toContain('finance.view');
      expect(res.json().permissions).toContain('users.manage');
    });

    it('GET /api/users/me requires a session', async () => {
      expect((await app.inject({ method: 'GET', url: '/api/users/me' })).statusCode).toBe(401);
    });
  });
});
