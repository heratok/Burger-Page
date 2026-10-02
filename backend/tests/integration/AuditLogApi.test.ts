import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/infrastructure/http/app.js';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';

describe('GET /api/audit-log and recording from the HTTP layer', () => {
  let app: FastifyInstance;
  const jwt = new JwtService();
  const superToken = jwt.generateToken({ id: 'user-superadmin', username: 'admin', role: 'super_admin' });
  const tenantToken = jwt.generateToken({ id: 'user-admin-craft', username: 'admin_craft', role: 'restaurant_admin', restaurantId: 'burger-craft' });
  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  beforeEach(async () => {
    app = buildApp();
    await app.ready();
  });
  afterEach(async () => {
    await app.close();
  });

  const call = (method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, payload?: unknown, token = superToken) =>
    app.inject({ method, url, headers: auth(token), payload: payload as any });
  const getLog = (qs = '', token = superToken) => app.inject({ method: 'GET', url: `/api/audit-log${qs}`, headers: auth(token) });

  it('is super admin only', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/audit-log' })).statusCode).toBe(401);
    expect((await getLog('', tenantToken)).statusCode).toBe(403);
    expect((await getLog()).statusCode).toBe(200);
  });

  it('records restaurant and user mutations with the authenticated actor, newest first, without secrets', async () => {
    const created = await call('POST', '/api/restaurants', { name: 'Auditada', slug: 'auditada', adminPassword: 'plain-secret-1' });
    expect(created.statusCode).toBe(201);
    const { id: restaurantId, adminUsername, adminPassword } = created.json();
    const adminUser = (await app.inject({ method: 'GET', url: `/api/users?restaurantId=${restaurantId}`, headers: auth(superToken) })).json()[0];

    expect((await call('POST', '/api/users', { username: 'otro_admin', password: 'password-xyz-9', role: 'restaurant_admin', restaurantId })).statusCode).toBe(201);
    expect((await call('PATCH', `/api/restaurants/${restaurantId}`, { name: 'Auditada 2', isActive: false })).statusCode).toBe(200);
    expect((await call('PATCH', `/api/users/${adminUser.id}`, { username: 'renombrado' })).statusCode).toBe(200);
    const reset = await call('POST', `/api/users/${adminUser.id}/reset-password`);
    expect(reset.statusCode).toBe(200);
    const { temporaryPassword } = reset.json();
    expect((await call('DELETE', `/api/restaurants/${restaurantId}`)).statusCode).toBe(200);

    const res = await getLog('?limit=200');
    expect(res.statusCode).toBe(200);
    const { items, nextCursor } = res.json();
    expect(nextCursor).toBeNull();
    expect(items.map((i: any) => i.action)).toEqual([
      'restaurant.delete',
      'user.reset_password',
      'user.update',
      'restaurant.update',
      'restaurant.pause',
      'user.create',
      'restaurant.create',
    ]);
    for (const item of items) {
      expect(item).toMatchObject({ actorUserId: 'user-superadmin', actorUsername: 'admin' });
      expect(Object.keys(item).sort()).toEqual(
        ['action', 'actorUserId', 'actorUsername', 'createdAt', 'details', 'id', 'restaurantId', 'targetId', 'targetLabel', 'targetType'].sort()
      );
    }
    const text = res.body;
    for (const secret of ['plain-secret-1', adminPassword, temporaryPassword, 'password-xyz-9']) {
      expect(text).not.toContain(secret);
    }
    expect(items[6]).toMatchObject({ targetType: 'restaurant', targetId: restaurantId, targetLabel: 'Auditada', restaurantId });
    expect(items[2].details.changes).toMatchObject({ username: { from: adminUsername, to: 'renombrado' } });
  });

  it('paginates with limit and cursor, and filters by action, restaurantId, actorUserId and dates', async () => {
    const a = (await call('POST', '/api/restaurants', { name: 'A1', slug: 'a-1' })).json();
    const b = (await call('POST', '/api/restaurants', { name: 'B1', slug: 'b-1' })).json();
    await call('PATCH', `/api/restaurants/${a.id}`, { tagline: 'x' });

    const p1 = (await getLog('?limit=2')).json();
    expect(p1.items).toHaveLength(2);
    expect(p1.nextCursor).toEqual(expect.any(String));
    const p2 = (await getLog(`?limit=2&cursor=${encodeURIComponent(p1.nextCursor)}`)).json();
    expect(p2.items).toHaveLength(1);
    expect(p2.nextCursor).toBeNull();
    expect(new Set([...p1.items, ...p2.items].map((i: any) => i.id)).size).toBe(3);

    expect((await getLog('?action=restaurant.create')).json().items).toHaveLength(2);
    expect((await getLog(`?restaurantId=${b.id}`)).json().items.map((i: any) => i.targetLabel)).toEqual(['B1']);
    expect((await getLog('?actorUserId=nobody')).json().items).toEqual([]);
    expect((await getLog('?actorUserId=user-superadmin')).json().items).toHaveLength(3);
    expect((await getLog('?from=2999-01-01T00:00:00.000Z')).json().items).toEqual([]);
    expect((await getLog('?to=2000-01-01T00:00:00.000Z')).json().items).toEqual([]);
    expect((await getLog('?from=2000-01-01T00:00:00.000Z&to=2999-01-01T00:00:00.000Z')).json().items).toHaveLength(3);
  });

  it('rejects invalid query parameters with 400', async () => {
    expect((await getLog('?limit=201')).statusCode).toBe(400);
    expect((await getLog('?limit=0')).statusCode).toBe(400);
    expect((await getLog('?action=restaurant.explode')).statusCode).toBe(400);
    expect((await getLog('?from=yesterday')).statusCode).toBe(400);
    expect((await getLog('?cursor=garbage')).statusCode).toBe(400);
  });

  it('does not record restaurant admin edits of their own tenant', async () => {
    const r = await call('PUT', '/api/restaurants/burger-craft', { tagline: 'mio' }, tenantToken);
    expect(r.statusCode).toBe(200);
    expect((await getLog()).json().items).toEqual([]);
  });

  it('exposes no way to alter history: only GET is routed', async () => {
    for (const method of ['POST', 'PATCH', 'PUT', 'DELETE'] as const) {
      const res = await app.inject({ method, url: '/api/audit-log', headers: auth(superToken), payload: {} });
      expect(res.statusCode).toBe(404);
    }
  });
});
