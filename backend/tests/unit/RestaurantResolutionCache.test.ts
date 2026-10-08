import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { ProductController } from '../../src/infrastructure/http/controllers/ProductController.js';
import { ProductAdditionController } from '../../src/infrastructure/http/controllers/ProductAdditionController.js';
import { RestaurantController } from '../../src/infrastructure/http/controllers/RestaurantController.js';
import { productRoutes } from '../../src/infrastructure/http/routes/product.routes.js';
import { errorHandler } from '../../src/infrastructure/http/middlewares/errorHandler.js';
import { MenuCache } from '../../src/infrastructure/cache/MenuCache.js';
import { RestaurantIdCache } from '../../src/infrastructure/cache/RestaurantIdCache.js';
import { tryAuth } from '../../src/infrastructure/http/middleware/auth.middleware.js';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';

type R = { id: string; slug: string; name: string; isActive: boolean };

function build(ttlMs?: number, now?: () => number) {
  const restaurants: R[] = [
    { id: 'rest-a', slug: 'alpha', name: 'Alpha', isActive: true },
    { id: 'rest-b', slug: 'beta', name: 'Beta', isActive: true },
  ];
  const restaurantRepo: any = {
    findById: vi.fn(async (id: string) => restaurants.find((r) => r.id === id) ?? null),
    findBySlug: vi.fn(async (slug: string) => restaurants.find((r) => r.slug === slug) ?? null),
  };
  const lookups = () => restaurantRepo.findById.mock.calls.length + restaurantRepo.findBySlug.mock.calls.length;
  const idCache = new RestaurantIdCache({ ttlMs, now });
  const menuCache = new MenuCache<any>();
  const listProducts = {
    execute: vi.fn(async (restaurantId: string) => [{ id: `p-${restaurantId}`, imageUrl: '', restaurantId }]),
  };
  const noop = { execute: vi.fn() } as any;
  const productController = new ProductController(
    listProducts as any, noop, noop, noop, noop, restaurantRepo, undefined, menuCache, idCache
  );
  const listAdditions = {
    execute: vi.fn(async (restaurantId: string, productId?: string, options?: any) => {
      const items = [{ id: `a-${restaurantId}`, restaurantId, productId }];
      return options ? { items, total: 3 } : items;
    }),
  };
  const additionController = new ProductAdditionController(
    listAdditions as any, noop, noop, noop, noop, restaurantRepo, menuCache, idCache
  );
  const updateRestaurant = {
    execute: vi.fn(async (id: string, data: any) => {
      const r = restaurants.find((x) => x.id === id)!;
      Object.assign(r, data);
      return r;
    }),
  };
  const deleteRestaurant = {
    execute: vi.fn(async (id: string) => {
      const i = restaurants.findIndex((x) => x.id === id || x.slug === id);
      restaurants.splice(i, 1);
    }),
  };
  const getRestaurant = { execute: vi.fn(async (id: string) => restaurants.find((r) => r.id === id || r.slug === id)) };
  const restaurantController = new RestaurantController(
    getRestaurant as any, noop, noop, deleteRestaurant as any, noop, updateRestaurant as any,
    undefined, undefined, undefined, menuCache, idCache
  );
  const app = fastify();
  app.setErrorHandler(errorHandler);
  app.register(productRoutes, { prefix: '/products', controller: productController });
  app.get('/additions', { preHandler: [tryAuth] }, (req, reply) => additionController.list(req, reply));
  return { app, restaurants, restaurantRepo, lookups, idCache, menuCache, listAdditions, restaurantController, updateRestaurant };
}

const fakeReply = () => {
  const r: any = { status: () => r, send: () => r, header: () => r };
  return r;
};

describe('restaurant identifier resolution cache', () => {
  let ctx: ReturnType<typeof build>;
  afterEach(async () => {
    await ctx.app.close();
  });

  describe('enabled', () => {
    beforeEach(async () => {
      ctx = build();
      await ctx.app.ready();
    });

    it('resolves a slug once and then avoids the repository', async () => {
      await ctx.app.inject({ method: 'GET', url: '/products?slug=alpha' });
      const after = ctx.lookups();
      await ctx.app.inject({ method: 'GET', url: '/products?slug=alpha' });
      expect(ctx.lookups()).toBe(after);
    });

    it('is shared by the additions controller', async () => {
      await ctx.app.inject({ method: 'GET', url: '/products?slug=alpha' });
      const after = ctx.lookups();
      const res = await ctx.app.inject({ method: 'GET', url: '/additions?slug=alpha' });
      expect(res.json()[0].restaurantId).toBe('rest-a');
      expect(ctx.lookups()).toBe(after);
    });

    it('never resolves slug A to restaurant B', async () => {
      await ctx.app.inject({ method: 'GET', url: '/products?slug=alpha' });
      const b = await ctx.app.inject({ method: 'GET', url: '/products?slug=beta' });
      expect(b.json()[0].restaurantId).toBe('rest-b');
    });

    it('does not cache unknown identifiers', async () => {
      expect((await ctx.app.inject({ method: 'GET', url: '/products?slug=ghost' })).statusCode).toBe(404);
      ctx.restaurants.push({ id: 'rest-g', slug: 'ghost', name: 'Ghost', isActive: true });
      expect((await ctx.app.inject({ method: 'GET', url: '/products?slug=ghost' })).statusCode).toBe(200);
    });

    it('does not cache inactive tenants and stops resolving a deactivated one after an update', async () => {
      await ctx.app.inject({ method: 'GET', url: '/products?slug=alpha' });
      ctx.restaurants[0].isActive = false;
      await ctx.restaurantController.update(
        { params: { id: 'rest-a' }, body: { isActive: false }, authContext: { role: 'super_admin' } } as any,
        fakeReply()
      );
      const res = await ctx.app.inject({ method: 'GET', url: '/products?slug=alpha' });
      expect(res.statusCode).toBe(400);
      expect(ctx.idCache.size).toBe(0);
    });

    it('resolves a renamed slug to the new value and not the old one', async () => {
      await ctx.app.inject({ method: 'GET', url: '/products?slug=alpha' });
      ctx.restaurants[0].slug = 'alpha-2';
      await ctx.restaurantController.update(
        { params: { id: 'rest-a' }, body: { slug: 'alpha-2' }, authContext: { role: 'super_admin' } } as any,
        fakeReply()
      );
      expect((await ctx.app.inject({ method: 'GET', url: '/products?slug=alpha' })).statusCode).toBe(404);
      const fresh = await ctx.app.inject({ method: 'GET', url: '/products?slug=alpha-2' });
      expect(fresh.json()[0].restaurantId).toBe('rest-a');
    });

    it('stops resolving a deleted tenant immediately, even when deleted by slug', async () => {
      await ctx.app.inject({ method: 'GET', url: '/products?slug=alpha' });
      await ctx.app.inject({ method: 'GET', url: '/products?restaurantId=rest-a' });
      await ctx.restaurantController.delete({ params: { id: 'alpha' } } as any, fakeReply());
      expect((await ctx.app.inject({ method: 'GET', url: '/products?slug=alpha' })).statusCode).toBe(404);
      expect((await ctx.app.inject({ method: 'GET', url: '/products?restaurantId=rest-a' })).statusCode).toBe(404);
    });

    it('is bypassed for authenticated tenants', async () => {
      const token = new JwtService().generateToken({ id: 'u', username: 'u', role: 'restaurant_admin', restaurantId: 'rest-a' });
      await ctx.app.inject({ method: 'GET', url: '/products', headers: { authorization: `Bearer ${token}` } });
      expect(ctx.idCache.size).toBe(0);
    });
  });

  it('expires entries after the TTL', async () => {
    let t = 0;
    ctx = build(100, () => t);
    await ctx.app.ready();
    await ctx.app.inject({ method: 'GET', url: '/products?slug=alpha' });
    const after = ctx.lookups();
    t = 101;
    await ctx.app.inject({ method: 'GET', url: '/products?slug=alpha' });
    expect(ctx.lookups()).toBeGreaterThan(after);
  });

  it('is off with ttl 0', async () => {
    ctx = build(0);
    await ctx.app.ready();
    await ctx.app.inject({ method: 'GET', url: '/products?slug=alpha' });
    const after = ctx.lookups();
    await ctx.app.inject({ method: 'GET', url: '/products?slug=alpha' });
    expect(ctx.lookups()).toBeGreaterThan(after);
  });
});

describe('GET /additions public cache', () => {
  let ctx: ReturnType<typeof build>;
  beforeEach(async () => {
    ctx = build();
    await ctx.app.ready();
  });
  afterEach(async () => {
    await ctx.app.close();
  });

  it('serves the second public request from cache and shares id/slug entries', async () => {
    await ctx.app.inject({ method: 'GET', url: '/additions?slug=alpha' });
    const second = await ctx.app.inject({ method: 'GET', url: '/additions?restaurantId=rest-a' });
    expect(second.json()[0].restaurantId).toBe('rest-a');
    expect(ctx.listAdditions.execute).toHaveBeenCalledTimes(1);
  });

  it('keys by productId and pagination and replays X-Total-Count', async () => {
    await ctx.app.inject({ method: 'GET', url: '/additions?slug=alpha&productId=p1' });
    await ctx.app.inject({ method: 'GET', url: '/additions?slug=alpha&productId=p2' });
    expect(ctx.listAdditions.execute).toHaveBeenCalledTimes(2);
    await ctx.app.inject({ method: 'GET', url: '/additions?slug=alpha&page=1&limit=5' });
    const hit = await ctx.app.inject({ method: 'GET', url: '/additions?slug=alpha&page=1&limit=5' });
    expect(hit.headers['x-total-count']).toBe('3');
    expect(ctx.listAdditions.execute).toHaveBeenCalledTimes(3);
  });

  it('never leaks entries across tenants', async () => {
    await ctx.app.inject({ method: 'GET', url: '/additions?slug=alpha' });
    const b = await ctx.app.inject({ method: 'GET', url: '/additions?slug=beta' });
    expect(b.json()[0].restaurantId).toBe('rest-b');
  });

  it('is invalidated by MenuCache.invalidate for the restaurant', async () => {
    await ctx.app.inject({ method: 'GET', url: '/additions?slug=alpha' });
    ctx.menuCache.invalidate('rest-a');
    await ctx.app.inject({ method: 'GET', url: '/additions?slug=alpha' });
    expect(ctx.listAdditions.execute).toHaveBeenCalledTimes(2);
  });

  it('bypasses the cache for authenticated requests', async () => {
    const token = new JwtService().generateToken({ id: 'u', username: 'u', role: 'restaurant_admin', restaurantId: 'rest-a' });
    const headers = { authorization: `Bearer ${token}` };
    await ctx.app.inject({ method: 'GET', url: '/additions', headers });
    await ctx.app.inject({ method: 'GET', url: '/additions', headers });
    expect(ctx.listAdditions.execute).toHaveBeenCalledTimes(2);
    expect(ctx.menuCache.size).toBe(0);
  });

  it('never caches errors', async () => {
    ctx.listAdditions.execute.mockRejectedValueOnce(new Error('boom'));
    expect((await ctx.app.inject({ method: 'GET', url: '/additions?slug=alpha' })).statusCode).toBe(500);
    expect((await ctx.app.inject({ method: 'GET', url: '/additions?slug=alpha' })).statusCode).toBe(200);
    expect(ctx.listAdditions.execute).toHaveBeenCalledTimes(2);
  });
});
