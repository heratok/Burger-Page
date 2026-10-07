import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp, buildDependencies, AppDependencies } from '../../src/infrastructure/http/app.js';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';

describe('Roles API', () => {
  let app: FastifyInstance;
  let deps: AppDependencies;
  let tokenTenant: string;
  let tokenOtherTenant: string;
  let tokenSuperAdmin: string;
  let tokenStaff: string;
  const jwtService = new JwtService();
  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  beforeAll(async () => {
    deps = buildDependencies(undefined, 'memory');
    app = buildApp(deps);
    await app.ready();
    tokenTenant = jwtService.generateToken({
      id: 'usr-admin-craft',
      username: 'admin_craft',
      role: 'restaurant_admin',
      restaurantId: 'burger-craft',
    });
    tokenOtherTenant = jwtService.generateToken({
      id: 'usr-admin-pizza',
      username: 'admin_pizza',
      role: 'restaurant_admin',
      restaurantId: 'tenant-a',
    });
    tokenSuperAdmin = jwtService.generateToken({ id: 'usr-root', username: 'root', role: 'super_admin' });
    tokenStaff = jwtService.generateToken({
      id: 'usr-staff',
      username: 'staff',
      role: 'restaurant_staff',
      restaurantId: 'burger-craft',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  const createRole = (token: string, payload: Record<string, unknown>) =>
    app.inject({ method: 'POST', url: '/api/roles', headers: auth(token), payload });

  it('requires authentication on every route', async () => {
    for (const [method, url] of [
      ['GET', '/api/roles'],
      ['POST', '/api/roles'],
      ['PUT', '/api/roles/role_x'],
      ['DELETE', '/api/roles/role_x'],
    ] as const) {
      const res = await app.inject({ method, url, payload: { name: 'x', permissions: [] } });
      expect(res.statusCode, `${method} ${url}`).toBe(401);
    }
  });

  it('forbids staff users on every route, even with a valid session', async () => {
    for (const [method, url] of [
      ['GET', '/api/roles'],
      ['POST', '/api/roles'],
      ['PUT', '/api/roles/role_x'],
      ['DELETE', '/api/roles/role_x'],
    ] as const) {
      const res = await app.inject({ method, url, headers: auth(tokenStaff), payload: { name: 'x', permissions: [] } });
      expect(res.statusCode, `${method} ${url}`).toBe(403);
    }
  });

  it('creates, lists, updates and deletes a role of the own restaurant', async () => {
    const created = await createRole(tokenTenant, {
      name: '  Cashier ',
      description: 'Front desk',
      permissions: ['orders.view', 'orders.manage'],
    });
    expect(created.statusCode).toBe(201);
    const role = JSON.parse(created.body);
    expect(role).toMatchObject({
      name: 'Cashier',
      description: 'Front desk',
      restaurantId: 'burger-craft',
      permissions: ['orders.view', 'orders.manage'],
      isSystem: false,
    });
    expect(role.id).toMatch(/^role_/);

    const list = await app.inject({ method: 'GET', url: '/api/roles', headers: auth(tokenTenant) });
    expect(list.statusCode).toBe(200);
    expect(JSON.parse(list.body).some((r: any) => r.id === role.id)).toBe(true);

    const updated = await app.inject({
      method: 'PUT',
      url: `/api/roles/${role.id}`,
      headers: auth(tokenTenant),
      payload: { name: 'Head cashier', permissions: ['orders.view', 'orders.manage', 'customers.view'] },
    });
    expect(updated.statusCode).toBe(200);
    expect(JSON.parse(updated.body)).toMatchObject({
      name: 'Head cashier',
      permissions: ['orders.view', 'orders.manage', 'customers.view'],
    });

    const removed = await app.inject({ method: 'DELETE', url: `/api/roles/${role.id}`, headers: auth(tokenTenant) });
    expect(removed.statusCode).toBe(204);
    const after = await app.inject({ method: 'GET', url: '/api/roles', headers: auth(tokenTenant) });
    expect(JSON.parse(after.body).some((r: any) => r.id === role.id)).toBe(false);
  });

  it('rejects invalid payloads with 400 and a duplicate name with 409', async () => {
    expect((await createRole(tokenTenant, { name: '', permissions: [] })).statusCode).toBe(400);
    expect((await createRole(tokenTenant, { name: 'x'.repeat(41), permissions: [] })).statusCode).toBe(400);
    expect((await createRole(tokenTenant, { name: 'Bad', permissions: ['db.drop'] })).statusCode).toBe(400);
    expect((await createRole(tokenTenant, { name: 'Bad', permissions: ['orders.view', 'orders.view'] })).statusCode).toBe(400);
    expect((await createRole(tokenTenant, { name: 'Bad' })).statusCode).toBe(400);

    expect((await createRole(tokenTenant, { name: 'Dup role', permissions: [] })).statusCode).toBe(201);
    expect((await createRole(tokenTenant, { name: ' dup ROLE ', permissions: [] })).statusCode).toBe(409);
    expect((await createRole(tokenOtherTenant, { name: 'Dup role', permissions: [] })).statusCode).toBe(201);
  });

  it('isolates tenants: another restaurant sees, edits and deletes nothing', async () => {
    const role = JSON.parse((await createRole(tokenTenant, { name: 'Private role', permissions: [] })).body);

    const list = await app.inject({ method: 'GET', url: '/api/roles', headers: auth(tokenOtherTenant) });
    expect(JSON.parse(list.body).some((r: any) => r.id === role.id)).toBe(false);

    const put = await app.inject({
      method: 'PUT', url: `/api/roles/${role.id}`, headers: auth(tokenOtherTenant), payload: { name: 'Hijacked' },
    });
    expect(put.statusCode).toBe(404);
    const del = await app.inject({ method: 'DELETE', url: `/api/roles/${role.id}`, headers: auth(tokenOtherTenant) });
    expect(del.statusCode).toBe(404);
  });

  it('ignores a restaurantId a tenant admin tries to inject', async () => {
    const res = await createRole(tokenTenant, { name: 'Injected', permissions: [], restaurantId: 'tenant-a' });
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body).restaurantId).toBe('burger-craft');
  });

  it('lets a super admin target a restaurant explicitly and requires one for mutations', async () => {
    const noTenant = await createRole(tokenSuperAdmin, { name: 'Orphan', permissions: [] });
    expect(noTenant.statusCode).toBeGreaterThanOrEqual(400);

    const created = await createRole(tokenSuperAdmin, { name: 'By root', permissions: ['finance.view'], restaurantId: 'tenant-a' });
    expect(created.statusCode).toBe(201);
    const role = JSON.parse(created.body);
    expect(role.restaurantId).toBe('tenant-a');

    const list = await app.inject({ method: 'GET', url: '/api/roles?restaurantId=tenant-a', headers: auth(tokenSuperAdmin) });
    expect(JSON.parse(list.body).some((r: any) => r.id === role.id)).toBe(true);

    const del = await app.inject({
      method: 'DELETE', url: `/api/roles/${role.id}?restaurantId=tenant-a`, headers: auth(tokenSuperAdmin),
    });
    expect(del.statusCode).toBe(204);
  });

  it('refuses to delete a role that a user still holds with 409', async () => {
    const role = JSON.parse((await createRole(tokenTenant, { name: 'Held', permissions: [] })).body);
    // There is no staff creation yet (TASK-05): seed a holder directly.
    await deps.userRepo.save({
      id: 'usr_holder', username: 'holder', passwordHash: 'x', role: 'restaurant_staff',
      restaurantId: 'burger-craft', roleId: role.id, createdAt: new Date().toISOString(),
    });
    const res = await app.inject({ method: 'DELETE', url: `/api/roles/${role.id}`, headers: auth(tokenTenant) });
    expect(res.statusCode).toBe(409);
    await deps.userRepo.delete('usr_holder');
    expect((await app.inject({ method: 'DELETE', url: `/api/roles/${role.id}`, headers: auth(tokenTenant) })).statusCode).toBe(204);
  });
});
