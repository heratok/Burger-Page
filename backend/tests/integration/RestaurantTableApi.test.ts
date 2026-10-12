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

  const createTable = async (token: string, zone: string, number: number, extra: Record<string, unknown> = {}) =>
    app.inject({ method: 'POST', url: '/api/tables', headers: auth(token), payload: { zone, number, ...extra } });

  const bulkTables = async (token: string, payload: Record<string, unknown>) =>
    app.inject({ method: 'POST', url: '/api/tables/bulk', headers: auth(token), payload });

  it('requires authentication on every route', async () => {
    for (const [method, url] of [
      ['GET', '/api/tables'],
      ['POST', '/api/tables'],
      ['PUT', '/api/tables/tbl_x'],
      ['DELETE', '/api/tables/tbl_x'],
      ['PUT', '/api/tables/order'],
      ['POST', '/api/tables/bulk'],
    ] as const) {
      const res = await app.inject({ method, url, payload: { zone: 'x', number: 1, from: 1, to: 2, ids: [] } });
      expect(res.statusCode, `${method} ${url}`).toBe(401);
    }
  });

  it('creates, lists, renames, deactivates and deletes a table of the own restaurant', async () => {
    const created = await createTable(tokenTenant, 'mesa api', 1, { alias: 'Ventana' });
    expect(created.statusCode).toBe(201);
    const table = JSON.parse(created.body);
    expect(table).toMatchObject({
      zone: 'Mesa api',
      number: 1,
      alias: 'Ventana',
      name: 'Mesa api 1 · Ventana',
      restaurantId: 'burger-craft',
      isActive: true,
    });
    expect(table.id).toMatch(/^tbl_/);

    const list = await app.inject({ method: 'GET', url: '/api/tables', headers: auth(tokenTenant) });
    expect(list.statusCode).toBe(200);
    expect(JSON.parse(list.body).some((t: any) => t.id === table.id)).toBe(true);

    const updated = await app.inject({
      method: 'PUT',
      url: `/api/tables/${table.id}`,
      headers: auth(tokenTenant),
      payload: { zone: 'Terraza API', number: 2, alias: null, isActive: false },
    });
    expect(updated.statusCode).toBe(200);
    expect(JSON.parse(updated.body)).toMatchObject({ zone: 'Terraza API', number: 2, alias: null, name: 'Terraza API 2', isActive: false });

    const removed = await app.inject({ method: 'DELETE', url: `/api/tables/${table.id}`, headers: auth(tokenTenant) });
    expect(removed.statusCode).toBe(204);
    const after = await app.inject({ method: 'GET', url: '/api/tables', headers: auth(tokenTenant) });
    expect(JSON.parse(after.body).some((t: any) => t.id === table.id)).toBe(false);
  });

  it('ignores a client-provided name: the name is always derived', async () => {
    const res = await createTable(tokenTenant, 'Derivada', 1, { name: 'Hack 99' });
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body)).toMatchObject({ zone: 'Derivada', number: 1, name: 'Derivada 1' });
  });

  it('rejects invalid zone/number with 400 and a duplicate (zone, number) with 409', async () => {
    expect((await createTable(tokenTenant, '', 1)).statusCode).toBe(400);
    expect((await createTable(tokenTenant, 'x'.repeat(31), 1)).statusCode).toBe(400);
    expect((await createTable(tokenTenant, 'Mesa', 0)).statusCode).toBe(400);
    expect((await createTable(tokenTenant, 'Mesa', 10000)).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/tables', headers: auth(tokenTenant), payload: { zone: 'Mesa' } })).statusCode).toBe(400);

    expect((await createTable(tokenTenant, 'Dup Zona', 5)).statusCode).toBe(201);
    const dup = await createTable(tokenTenant, 'dup  zona', 5, { alias: 'otro' });
    expect(dup.statusCode).toBe(409);
    expect(JSON.parse(dup.body).detail).toContain("Ya existe la mesa 'Dup zona 5'");
    expect((await createTable(tokenTenant, 'Dup Zona', 6)).statusCode).toBe(201);
  });

  it('bulk creates a range, skipping existing numbers and returning { created, skipped }', async () => {
    expect((await createTable(tokenTenant, 'Bulk', 2)).statusCode).toBe(201);

    const res = await bulkTables(tokenTenant, { zone: 'bulk', from: 1, to: 3 });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.skipped).toEqual([2]);
    expect(body.created.map((t: any) => t.name)).toEqual(['Bulk 1', 'Bulk 3']);
    expect(body.created[0]).toMatchObject({ zone: 'Bulk', number: 1, alias: null, restaurantId: 'burger-craft', isActive: true });

    const list = JSON.parse((await app.inject({ method: 'GET', url: '/api/tables', headers: auth(tokenTenant) })).body);
    expect(list.filter((t: any) => t.zone === 'Bulk')).toHaveLength(3);
  });

  it('bulk rejects an invalid range with 400', async () => {
    expect((await bulkTables(tokenTenant, { zone: 'Bad', from: 5, to: 4 })).statusCode).toBe(400);
    expect((await bulkTables(tokenTenant, { zone: 'Bad', from: 1, to: 101 })).statusCode).toBe(400);
    expect((await bulkTables(tokenTenant, { zone: '', from: 1, to: 2 })).statusCode).toBe(400);
    expect((await bulkTables(tokenTenant, { zone: 'Bad', from: 0, to: 2 })).statusCode).toBe(400);
  });

  it('bulk is scoped to the caller restaurant', async () => {
    const res = await bulkTables(tokenOtherTenant, { zone: 'Scoped', from: 1, to: 2, restaurantId: 'burger-craft' });
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body).created.every((t: any) => t.restaurantId === 'tenant-a')).toBe(true);
  });

  it('isolates tenants: another restaurant cannot list, rename or delete the table', async () => {
    const table = JSON.parse((await createTable(tokenTenant, 'Privada', 1)).body);

    const otherList = await app.inject({ method: 'GET', url: '/api/tables', headers: auth(tokenOtherTenant) });
    expect(JSON.parse(otherList.body).some((t: any) => t.id === table.id)).toBe(false);

    const rename = await app.inject({
      method: 'PUT',
      url: `/api/tables/${table.id}`,
      headers: auth(tokenOtherTenant),
      payload: { zone: 'Hacked' },
    });
    expect(rename.statusCode).toBe(404);
    const del = await app.inject({ method: 'DELETE', url: `/api/tables/${table.id}`, headers: auth(tokenOtherTenant) });
    expect(del.statusCode).toBe(404);

    // A restaurant admin cannot target another tenant through restaurantId.
    const spoof = await app.inject({
      method: 'POST',
      url: '/api/tables',
      headers: auth(tokenOtherTenant),
      payload: { zone: 'Spoof', number: 1, restaurantId: 'burger-craft' },
    });
    expect(spoof.statusCode).toBe(201);
    expect(JSON.parse(spoof.body).restaurantId).toBe('tenant-a');
  });

  it('lets a super admin manage the table of an explicitly targeted restaurant', async () => {
    const noTarget = await createTable(tokenSuperAdmin, 'Root', 1);
    expect(noTarget.statusCode).toBeGreaterThanOrEqual(400);

    const res = await createTable(tokenSuperAdmin, 'Root', 1, { restaurantId: 'burger-craft' });
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body).restaurantId).toBe('burger-craft');
  });

  it('reorders tables with PUT /api/tables/order and rejects foreign ids', async () => {
    const a = JSON.parse((await createTable(tokenOtherTenant, 'Orden', 1)).body);
    const b = JSON.parse((await createTable(tokenOtherTenant, 'Orden', 2)).body);
    const foreign = JSON.parse((await createTable(tokenTenant, 'Orden', 3)).body);

    const ok = await app.inject({
      method: 'PUT',
      url: '/api/tables/order',
      headers: auth(tokenOtherTenant),
      payload: { ids: [b.id, a.id] },
    });
    expect(ok.statusCode).toBe(200);
    const names = JSON.parse(ok.body).map((t: any) => t.name);
    expect(names.indexOf('Orden 2')).toBeLessThan(names.indexOf('Orden 1'));

    const bad = await app.inject({
      method: 'PUT',
      url: '/api/tables/order',
      headers: auth(tokenOtherTenant),
      payload: { ids: [a.id, foreign.id] },
    });
    expect(bad.statusCode).toBe(400);
  });
});
