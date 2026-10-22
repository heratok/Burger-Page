import { describe, it, expect, vi } from 'vitest';
import type { FastifyRequest } from 'fastify';
import { RestaurantController } from '../../src/infrastructure/http/controllers/RestaurantController.js';

/**
 * Restaurant A's slug happens to equal restaurant B's id (legacy data). The
 * ownership guard accepts A's admin targeting that identifier as "its slug",
 * but the write itself must land on A's canonical id, never on B.
 */
describe('RestaurantController tenant writes use the canonical own id', () => {
  const own = { id: 'rest-a', slug: 'rest-b' };
  const getRestaurant = { execute: vi.fn(async (idOrSlug: string) => (idOrSlug === 'rest-a' ? own : null)) };
  const updateRestaurant = { execute: vi.fn(async (id: string) => ({ id, slug: 'x' })) };
  const updateCategories = { execute: vi.fn(async (id: string) => ({ id, categories: [] })) };
  const noop = {} as any;
  const controller = new RestaurantController(
    getRestaurant as any, noop, noop, noop, updateCategories as any, updateRestaurant as any
  );
  const reply = () => {
    const r: any = { status: () => r, send: () => r, header: () => r };
    return r;
  };
  const tenantReq = (extra: Record<string, unknown>) =>
    ({
      authContext: { userId: 'u', username: 'admin_a', role: 'restaurant_admin', restaurantId: 'rest-a', permissions: [] },
      ...extra,
    }) as unknown as FastifyRequest;

  it('PUT /restaurants/:id', async () => {
    await controller.update(tenantReq({ params: { id: 'rest-b' }, body: { name: 'A renamed' } }), reply());
    expect(updateRestaurant.execute).toHaveBeenCalledWith('rest-a', expect.anything(), 'restaurant_admin', expect.anything());
  });

  it('PUT /restaurant/:slug/categories', async () => {
    await controller.updateCategories(tenantReq({ params: { slug: 'rest-b' }, body: { categories: ['Burgers'] } }), reply());
    expect(updateCategories.execute).toHaveBeenCalledWith('rest-a', ['Burgers'], undefined);
  });
});
