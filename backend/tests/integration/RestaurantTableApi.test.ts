import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/infrastructure/http/app.js';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';

describe('Restaurant tables API', () => {
  let app: FastifyInstance;
  let tokenTenant: string;
  let tokenOtherTenant: string;
  let tokenSuperAdmin: string;
  const jwtService = new JwtService();
  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  beforeAll(async () => {
    app = buildApp();
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
  });

  afterAll(async () => {
    await app.close();
  });

  const createTable = async (token: string, name: string, extra: Record<string, unknown> = {}) =>
    app.inject({ method: 'POST', url: '/api/tables', headers: auth(token), payload: { name, ...extra } });

  it('requires authentication on every route', async () => {
    for (const [method, url] of [
      ['GET', '/api/tables'],
      ['POST', '/api/tables'],
      ['PUT', '/api/tables/tbl_x'],
      ['DELETE', '/api/tables/tbl_x'],
      ['PUT', '/api/tables/order'],
    ] as const) {
      const res = await app.inject({ method, url, payload: { name: 'x', ids: [] } });
      expect(res.statusCode, `${method} ${url}`).toBe(401);
    }
  });

  it('creates, lists, renames, deactivates and deletes a table of the own restaurant', async () => {
    const created = await createTable(tokenTenant, 'Mesa API 1');
    expect(created.statusCode).toBe(201);
    const table = JSON.parse(created.body);
    expect(table).toMatchObject({ name: 'Mesa API 1', restaurantId: 'burger-craft', isActive: true });
    expect(table.id).toMatch(/^tbl_/);

    const list = await app.inject({ method: 'GET', url: '/api/tables', headers: auth(tokenTenant) });
    expect(list.statusCode).toBe(200);
    expect(JSON.parse(list.body).some((t: any) => t.id === table.id)).toBe(true);

    const updated = await app.inject({
      method: 'PUT',
      url: `/api/tables/${table.id}`,
      headers: auth(tokenTenant),
      payload: { name: 'Terraza API 1', isActive: false },
    });
    expect(updated.statusCode).toBe(200);
    expect(JSON.parse(updated.body)).toMatchObject({ name: 'Terraza API 1', isActive: false });

    const removed = await app.inject({ method: 'DELETE', url: `/api/tables/${table.id}`, headers: auth(tokenTenant) });
    expect(removed.statusCode).toBe(204);
    const after = await app.inject({ method: 'GET', url: '/api/tables', headers: auth(tokenTenant) });
    expect(JSON.parse(after.body).some((t: any) => t.id === table.id)).toBe(false);
  });

  it('rejects an empty name with 400 and a duplicate name with 409', async () => {
    expect((await createTable(tokenTenant, '')).statusCode).toBe(400);
    expect((await createTable(tokenTenant, 'x'.repeat(41))).statusCode).toBe(400);

    expect((await createTable(tokenTenant, 'Mesa Dup')).statusCode).toBe(201);
    const dup = await createTable(tokenTenant, 'mesa dup');
    expect(dup.statusCode).toBe(409);
    expect(JSON.parse(dup.body).detail).toContain("Ya existe una mesa llamada 'mesa dup'.");
    expect((await createTable(tokenTenant, 'mesa   dup')).statusCode).toBe(409);
  });

  it('isolates tenants: another restaurant cannot list, rename or delete the table', async () => {
    const table = JSON.parse((await createTable(tokenTenant, 'Mesa Privada')).body);

    const otherList = await app.inject({ method: 'GET', url: '/api/tables', headers: auth(tokenOtherTenant) });
    expect(JSON.parse(otherList.body).some((t: any) => t.id === table.id)).toBe(false);

    const rename = await app.inject({
      method: 'PUT',
      url: `/api/tables/${table.id}`,
      headers: auth(tokenOtherTenant),
      payload: { name: 'Hacked' },
    });
    expect(rename.statusCode).toBe(404);
    const del = await app.inject({ method: 'DELETE', url: `/api/tables/${table.id}`, headers: auth(tokenOtherTenant) });
    expect(del.statusCode).toBe(404);

    // A restaurant admin cannot target another tenant through restaurantId.
    const spoof = await app.inject({
      method: 'POST',
      url: '/api/tables',
      headers: auth(tokenOtherTenant),
      payload: { name: 'Spoof', restaurantId: 'burger-craft' },
    });
    expect(spoof.statusCode).toBe(201);
    expect(JSON.parse(spoof.body).restaurantId).toBe('tenant-a');
  });

  it('lets a super admin manage the table of an explicitly targeted restaurant', async () => {
    const noTarget = await createTable(tokenSuperAdmin, 'Mesa Root');
    expect(noTarget.statusCode).toBeGreaterThanOrEqual(400);

    const res = await createTable(tokenSuperAdmin, 'Mesa Root', { restaurantId: 'burger-craft' });
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body).restaurantId).toBe('burger-craft');
  });

  it('reorders tables with PUT /api/tables/order and rejects foreign ids', async () => {
    const a = JSON.parse((await createTable(tokenOtherTenant, 'Orden A')).body);
    const b = JSON.parse((await createTable(tokenOtherTenant, 'Orden B')).body);
    const foreign = JSON.parse((await createTable(tokenTenant, 'Orden Foreign')).body);

    const ok = await app.inject({
      method: 'PUT',
      url: '/api/tables/order',
      headers: auth(tokenOtherTenant),
      payload: { ids: [b.id, a.id] },
    });
    expect(ok.statusCode).toBe(200);
    const names = JSON.parse(ok.body).map((t: any) => t.name);
    expect(names.indexOf('Orden B')).toBeLessThan(names.indexOf('Orden A'));

    const bad = await app.inject({
      method: 'PUT',
      url: '/api/tables/order',
      headers: auth(tokenOtherTenant),
      payload: { ids: [a.id, foreign.id] },
    });
    expect(bad.statusCode).toBe(400);
  });
});
