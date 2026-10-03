import { describe, it, expect, vi } from 'vitest';
import type { FastifyRequest } from 'fastify';
import { assertOwnsRestaurant } from '../../src/infrastructure/http/RestaurantOwnershipGuard.js';
import { GetRestaurantUseCase } from '../../src/application/use-cases/GetRestaurantUseCase.js';

// Direct branch coverage of the ownership guard that RestaurantController's
// update()/updateCategories()/list() share. It answers "may this admin touch
// restaurant X": null means proceed, otherwise the 403 problem body to send.

const reqWith = (authContext: unknown) => ({ authContext }) as unknown as FastifyRequest;

const getRestaurant = (assigned: { id: string; slug: string } | null) => {
  const execute = vi.fn(async (_idOrSlug: string) => assigned);
  return { useCase: { execute } as unknown as GetRestaurantUseCase, execute };
};

const forbidden = (detail: string) => ({
  type: 'https://example.com/probs/forbidden',
  title: 'Forbidden',
  status: 403,
  detail,
});

describe('assertOwnsRestaurant', () => {
  it('lets a super_admin through without resolving any restaurant', async () => {
    const { useCase, execute } = getRestaurant(null);
    const out = await assertOwnsRestaurant(
      reqWith({ role: 'super_admin' }), 'any-tenant', useCase, 'update your own restaurant'
    );
    expect(out).toBeNull();
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects a restaurant_admin with no assigned restaurantId', async () => {
    const { useCase, execute } = getRestaurant(null);
    const out = await assertOwnsRestaurant(
      reqWith({ role: 'restaurant_admin' }), 'burger-craft', useCase, 'update your own restaurant'
    );
    expect(out).toEqual(forbidden('Restaurant administrator has no assigned restaurant.'));
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects a request with no auth context at all', async () => {
    const { useCase } = getRestaurant(null);
    const out = await assertOwnsRestaurant(reqWith(undefined), 'burger-craft', useCase, 'update your own restaurant');
    expect(out).toEqual(forbidden('Restaurant administrator has no assigned restaurant.'));
  });

  it('passes when the target is the owner id, without a lookup', async () => {
    const { useCase, execute } = getRestaurant(null);
    const out = await assertOwnsRestaurant(
      reqWith({ role: 'restaurant_admin', restaurantId: 'rest-1' }), 'rest-1', useCase, 'update your own restaurant'
    );
    expect(out).toBeNull();
    expect(execute).not.toHaveBeenCalled();
  });

  it('passes when no target identifier is given (e.g. list)', async () => {
    const { useCase, execute } = getRestaurant(null);
    const out = await assertOwnsRestaurant(
      reqWith({ role: 'restaurant_admin', restaurantId: 'rest-1' }), undefined, useCase, 'list your own restaurant'
    );
    expect(out).toBeNull();
    expect(execute).not.toHaveBeenCalled();
  });

  it('passes when the target is the owner slug (resolved via the assigned restaurant)', async () => {
    const { useCase, execute } = getRestaurant({ id: 'rest-1', slug: 'burger-craft' });
    const out = await assertOwnsRestaurant(
      reqWith({ role: 'restaurant_admin', restaurantId: 'rest-1' }), 'burger-craft', useCase, 'update your own restaurant'
    );
    expect(out).toBeNull();
    expect(execute).toHaveBeenCalledWith('rest-1');
  });

  it('rejects a target that is neither the owner id nor slug, with the action label in the detail', async () => {
    const { useCase } = getRestaurant({ id: 'rest-1', slug: 'burger-craft' });
    const out = await assertOwnsRestaurant(
      reqWith({ role: 'restaurant_admin', restaurantId: 'rest-1' }), 'rest-2', useCase, 'update your own restaurant'
    );
    expect(out).toEqual(forbidden('You are only authorized to update your own restaurant.'));
  });

  it('rejects a foreign target when the assigned restaurant no longer exists', async () => {
    const { useCase } = getRestaurant(null);
    const out = await assertOwnsRestaurant(
      reqWith({ role: 'restaurant_admin', restaurantId: 'rest-1' }), 'rest-2', useCase, 'update categories of your own restaurant'
    );
    expect(out).toEqual(forbidden('You are only authorized to update categories of your own restaurant.'));
  });
});
