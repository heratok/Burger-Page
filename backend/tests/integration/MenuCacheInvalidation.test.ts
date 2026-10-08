import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/infrastructure/http/app.js';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';
import { MenuCache } from '../../src/infrastructure/cache/MenuCache.js';

describe('Public menu cache end to end', () => {
  let app: FastifyInstance;
  let staff: Record<string, string>;
  let superAdmin: Record<string, string>;
  const jwt = new JwtService();
  const publicMenu = () => app.inject({ method: 'GET', url: '/api/products?slug=burger-craft' });
  const invalidate = vi.spyOn(MenuCache.prototype, 'invalidate');

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
    staff = {
      authorization: `Bearer ${jwt.generateToken({ id: 'u1', username: 'm', role: 'restaurant_admin', restaurantId: 'burger-craft' })}`,
    };
    superAdmin = { authorization: `Bearer ${jwt.generateToken({ id: 'sa', username: 'sa', role: 'super_admin' })}` };
  });
  afterEach(() => invalidate.mockClear());
  afterAll(async () => {
    await app.close();
    invalidate.mockRestore();
  });

  it('a product write is reflected by the next public GET', async () => {
    const before = (await publicMenu()).json();
    await publicMenu(); // warm the cache

    const created = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: staff,
      payload: { name: 'Cache Probe Burger', price: 1000, category: 'Burgers', isAvailable: true, additions: [] },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().id;

    const afterCreate = (await publicMenu()).json();
    expect(afterCreate.length).toBe(before.length + 1);

    await app.inject({ method: 'PUT', url: `/api/products/${id}`, headers: staff, payload: { name: 'Renamed Probe' } });
    expect((await publicMenu()).json().some((p: any) => p.name === 'Renamed Probe')).toBe(true);

    await app.inject({ method: 'PUT', url: `/api/products/${id}`, headers: staff, payload: { isAvailable: false } });
    expect((await publicMenu()).json().some((p: any) => p.id === id)).toBe(false);

    await app.inject({ method: 'DELETE', url: `/api/products/${id}`, headers: staff });
    expect((await publicMenu()).json().length).toBe(before.length);
  });

  it('addition create, update and delete invalidate the tenant menu', async () => {
    const created = await app.inject({ method: 'POST', url: '/api/additions', headers: staff, payload: { name: 'Probe Add', price: 100 } });
    expect(created.statusCode).toBe(201);
    const id = created.json().id;
    await app.inject({ method: 'PUT', url: `/api/additions/${id}`, headers: staff, payload: { price: 200 } });
    await app.inject({ method: 'DELETE', url: `/api/additions/${id}`, headers: staff });
    const ids = invalidate.mock.calls.map((c) => c[0]);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(1);
  });

  it('category updates invalidate the tenant menu', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/restaurant/categories',
      headers: staff,
      payload: { categories: ['Burgers', 'Bebidas'] },
    });
    expect(res.statusCode).toBe(200);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('restaurant update, delete and restore invalidate the tenant menu', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/restaurants',
      headers: superAdmin,
      payload: { name: 'Cache Tenant', slug: 'cache-tenant', whatsappNumber: '573001112233', templateType: 'pizza', categories: ['Pizzas'] },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().id;
    invalidate.mockClear();

    const updated = await app.inject({ method: 'PUT', url: `/api/restaurants/${id}`, headers: superAdmin, payload: { name: 'Cache Tenant 2' } });
    expect(updated.statusCode).toBe(200);
    expect(invalidate).toHaveBeenLastCalledWith(id);

    expect((await app.inject({ method: 'DELETE', url: `/api/restaurants/${id}`, headers: superAdmin })).statusCode).toBe(200);
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenLastCalledWith(id);

    const restored = await app.inject({ method: 'POST', url: `/api/restaurants/${id}/restore`, headers: superAdmin, payload: {} });
    expect(restored.statusCode).toBe(200);
    expect(invalidate).toHaveBeenCalledTimes(3);
    expect(invalidate).toHaveBeenLastCalledWith(id);
  });
});
