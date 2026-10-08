import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { ProductController } from '../../src/infrastructure/http/controllers/ProductController.js';
import { productRoutes } from '../../src/infrastructure/http/routes/product.routes.js';
import { errorHandler } from '../../src/infrastructure/http/middlewares/errorHandler.js';
import { MenuCache } from '../../src/infrastructure/cache/MenuCache.js';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';

const restaurants = [
  { id: 'rest-a', slug: 'alpha', name: 'Alpha', isActive: true },
  { id: 'rest-b', slug: 'beta', name: 'Beta', isActive: true },
  { id: 'rest-off', slug: 'off', name: 'Off', isActive: false },
];

function build() {
  const listProducts = {
    execute: vi.fn(async (restaurantId: string, _availableOnly: boolean, options?: any) => {
      const items = [{ id: `p-${restaurantId}`, name: 'Burger', imageUrl: '', restaurantId }];
      return options ? { items, total: 7 } : items;
    }),
  };
  const writer = { execute: vi.fn(async () => ({ id: 'p-new', imageUrl: '' })) };
  const restaurantRepo: any = {
    findById: async (id: string) => restaurants.find((r) => r.id === id) ?? null,
    findBySlug: async (slug: string) => restaurants.find((r) => r.slug === slug) ?? null,
  };
  const cache = new MenuCache<any>();
  const controller = new ProductController(
    listProducts as any,
    { execute: vi.fn() } as any,
    writer as any,
    writer as any,
    { execute: vi.fn(async () => undefined) } as any,
    restaurantRepo,
    undefined,
    cache
  );
  const app = fastify();
  app.setErrorHandler(errorHandler);
  app.register(productRoutes, { prefix: '/products', controller });
  return { app, listProducts, cache };
}

describe('GET /products public menu cache', () => {
  let ctx: ReturnType<typeof build>;
  const jwt = new JwtService();
  const staffToken = jwt.generateToken({ id: 'u1', username: 'staff', role: 'restaurant_admin', restaurantId: 'rest-a' });

  beforeEach(async () => {
    ctx = build();
    await ctx.app.ready();
  });
  afterEach(async () => {
    await ctx.app.close();
  });

  it('serves the second public request from cache', async () => {
    const first = await ctx.app.inject({ method: 'GET', url: '/products?restaurantId=rest-a' });
    const second = await ctx.app.inject({ method: 'GET', url: '/products?restaurantId=rest-a' });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual(first.json());
    expect(ctx.listProducts.execute).toHaveBeenCalledTimes(1);
  });

  it('shares the entry between id and slug requests of the same restaurant', async () => {
    await ctx.app.inject({ method: 'GET', url: '/products?restaurantId=rest-a' });
    const bySlug = await ctx.app.inject({ method: 'GET', url: '/products?slug=alpha' });
    expect(bySlug.json()[0].restaurantId).toBe('rest-a');
    expect(ctx.listProducts.execute).toHaveBeenCalledTimes(1);
  });

  it('never leaks entries across tenants', async () => {
    await ctx.app.inject({ method: 'GET', url: '/products?slug=alpha' });
    const b = await ctx.app.inject({ method: 'GET', url: '/products?slug=beta' });
    expect(b.json()[0].restaurantId).toBe('rest-b');
    expect(ctx.listProducts.execute).toHaveBeenCalledTimes(2);
  });

  it('keys by pagination and replays the X-Total-Count header', async () => {
    const first = await ctx.app.inject({ method: 'GET', url: '/products?slug=alpha&page=1&limit=5' });
    const second = await ctx.app.inject({ method: 'GET', url: '/products?slug=alpha&page=1&limit=5' });
    expect(first.headers['x-total-count']).toBe('7');
    expect(second.headers['x-total-count']).toBe('7');
    expect(ctx.listProducts.execute).toHaveBeenCalledTimes(1);
    await ctx.app.inject({ method: 'GET', url: '/products?slug=alpha' });
    expect(ctx.listProducts.execute).toHaveBeenCalledTimes(2);
  });

  it('bypasses the cache for authenticated requests', async () => {
    await ctx.app.inject({ method: 'GET', url: '/products?slug=alpha' });
    const headers = { authorization: `Bearer ${staffToken}` };
    await ctx.app.inject({ method: 'GET', url: '/products', headers });
    await ctx.app.inject({ method: 'GET', url: '/products', headers });
    // 1 public miss + 2 uncached staff reads
    expect(ctx.listProducts.execute).toHaveBeenCalledTimes(3);
    expect(ctx.listProducts.execute).toHaveBeenLastCalledWith('rest-a', false);
  });

  it('does not cache error responses', async () => {
    const missing = await ctx.app.inject({ method: 'GET', url: '/products?slug=nope' });
    const inactive = await ctx.app.inject({ method: 'GET', url: '/products?slug=off' });
    expect(missing.statusCode).toBe(404);
    expect(inactive.statusCode).toBe(400);
    expect(ctx.cache.size).toBe(0);

    ctx.listProducts.execute.mockRejectedValueOnce(new Error('db down'));
    const failed = await ctx.app.inject({ method: 'GET', url: '/products?slug=alpha' });
    expect(failed.statusCode).toBeGreaterThanOrEqual(500);
    const retry = await ctx.app.inject({ method: 'GET', url: '/products?slug=alpha' });
    expect(retry.statusCode).toBe(200);
  });

  it('returns a fresh object per request (no shared mutation)', async () => {
    await ctx.app.inject({ method: 'GET', url: '/products?slug=alpha' });
    const hit = await ctx.app.inject({ method: 'GET', url: '/products?slug=alpha' });
    expect(hit.json()[0].name).toBe('Burger');
    const copy = ctx.cache.get('rest-a', 'all')!;
    (copy.body[0] as any).name = 'Mutated';
    expect((ctx.cache.get('rest-a', 'all')!.body[0] as any).name).toBe('Burger');
  });

  it('invalidates the restaurant cache on product create, update and delete', async () => {
    const headers = { authorization: `Bearer ${staffToken}` };
    const warm = async () => {
      await ctx.app.inject({ method: 'GET', url: '/products?slug=alpha' });
      await ctx.app.inject({ method: 'GET', url: '/products?slug=beta' });
    };
    const writes = [
      { method: 'POST', url: '/products', payload: { name: 'X', description: 'd', price: 5, category: 'Burgers' } },
      { method: 'PUT', url: '/products/p1', payload: { price: 6 } },
      { method: 'DELETE', url: '/products/p1' },
    ] as const;
    for (const w of writes) {
      await warm();
      const res = await ctx.app.inject({ ...w, headers });
      expect(res.statusCode).toBeLessThan(300);
      expect(ctx.cache.get('rest-a', 'all')).toBeUndefined();
      expect(ctx.cache.get('rest-b', 'all')).toBeDefined();
    }
  });
});
