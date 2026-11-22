import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyRequest } from 'fastify';
import { RestaurantController } from '../../src/infrastructure/http/controllers/RestaurantController.js';
import { ValidationError } from '../../src/domain/errors/DomainErrors.js';

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
  const tenantReq = (extra: Record<string, unknown>, role: 'restaurant_admin' | 'restaurant_staff' = 'restaurant_admin') =>
    ({
      authContext: { userId: 'u', username: 'admin_a', role, restaurantId: 'rest-a', permissions: [] },
      ...extra,
    }) as unknown as FastifyRequest;
  const superAdminReq = (extra: Record<string, unknown>, restaurantId?: string) =>
    ({
      authContext: { userId: 'su', username: 'superadmin', role: 'super_admin', ...(restaurantId ? { restaurantId } : {}), permissions: [] },
      ...extra,
    }) as unknown as FastifyRequest;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('PUT /restaurants/:id', async () => {
    await controller.update(tenantReq({ params: { id: 'rest-b' }, body: { name: 'A renamed' } }), reply());
    expect(updateRestaurant.execute).toHaveBeenCalledWith('rest-a', expect.anything(), 'restaurant_admin', expect.anything());
  });

  it('PUT /restaurant/:slug/categories', async () => {
    await controller.updateCategories(tenantReq({ params: { slug: 'rest-b' }, body: { categories: ['Burgers'] } }), reply());
    expect(updateCategories.execute).toHaveBeenCalledWith('rest-a', ['Burgers'], undefined);
  });

  it('PUT /restaurant/:slug/categories with restaurant_staff writes canonical own id even when slug/body names another', async () => {
    await controller.updateCategories(
      tenantReq({ params: { slug: 'rest-b' }, body: { categories: ['Burgers'], restaurantId: 'rest-b' } }, 'restaurant_staff'),
      reply()
    );
    expect(updateCategories.execute).toHaveBeenCalledWith('rest-a', ['Burgers'], undefined);
  });

  it('PUT /restaurant/categories with super_admin lacking slug and session restaurantId rejects with ValidationError and never calls update use case', async () => {
    await expect(
      controller.updateCategories(superAdminReq({ params: {}, body: { categories: ['Burgers'] } }), reply())
    ).rejects.toSatisfy((err: unknown) => err instanceof ValidationError && /slug|restaurantId/i.test(err.message));

    expect(updateCategories.execute).not.toHaveBeenCalled();
  });

  it('PUT /restaurant/:slug/categories with super_admin and slug writes that slug', async () => {
    await controller.updateCategories(
      superAdminReq({ params: { slug: 'tacos-el-rey' }, body: { categories: ['Tacos'] } }),
      reply()
    );
    expect(updateCategories.execute).toHaveBeenCalledWith('tacos-el-rey', ['Tacos'], undefined);
  });

  it('PUT /restaurant/categories with super_admin bound to session restaurantId writes that restaurantId', async () => {
    await controller.updateCategories(
      superAdminReq({ params: {}, body: { categories: ['Combos'] } }, 'rest-bound'),
      reply()
    );
    expect(updateCategories.execute).toHaveBeenCalledWith('rest-bound', ['Combos'], undefined);
  });
});
