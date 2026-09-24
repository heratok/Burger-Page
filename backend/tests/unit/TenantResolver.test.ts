import { describe, it, expect } from 'vitest';
import { resolveTenantForRequest } from '../../src/infrastructure/http/TenantResolver.js';
import { RestaurantRepository } from '../../src/domain/ports/out/RestaurantRepository.js';
import { Restaurant } from '../../src/domain/models/Restaurant.js';
import { EntityNotFoundError } from '../../src/domain/errors/DomainErrors.js';

// D1 (backend review): the tenant-resolution logic that used to live in five
// controllers now lives here. These tests pin the canonical CustomerController
// behavior plus the M7 guard, which Order/ProductAddition mutations previously
// lacked (they returned '' instead of throwing when a provided tenant could
// not be resolved).

class FakeRestaurantRepository implements RestaurantRepository {
  calls: string[] = [];
  private restaurants: Restaurant[];

  constructor(restaurants: Restaurant[]) {
    this.restaurants = restaurants;
  }

  async findById(id: string): Promise<Restaurant | null> {
    this.calls.push(`findById:${id}`);
    return this.restaurants.find((r) => r.id === id) || null;
  }

  async findBySlug(slug: string): Promise<Restaurant | null> {
    this.calls.push(`findBySlug:${slug}`);
    return this.restaurants.find((r) => r.slug === slug) || null;
  }

  async findAll(): Promise<Restaurant[]> {
    this.calls.push('findAll');
    return [...this.restaurants];
  }

  async save(): Promise<void> {}
  async delete(): Promise<void> {}
}

function restaurant(id: string, overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    id,
    name: id,
    slug: id,
    theme: 'light',
    openingHours: { open: '09:00', close: '22:00' },
    isActive: true,
    ...overrides,
  };
}

function req(overrides: {
  authContext?: any;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
} = {}) {
  return {
    authContext: overrides.authContext,
    query: overrides.query || {},
    body: overrides.body || {},
    headers: overrides.headers || {},
  } as any;
}

function superAdmin() {
  return { userId: 'usr-super', username: 'root', role: 'super_admin' };
}

describe('resolveTenantForRequest (shared tenant resolver, review finding D1)', () => {
  it('staff session: authContext.restaurantId wins (existence lookup only, no scan)', async () => {
    const repo = new FakeRestaurantRepository([restaurant('rest-a'), restaurant('rest-b')]);
    const result = await resolveTenantForRequest(
      req({
        authContext: { userId: 'usr-1', username: 'staff', role: 'restaurant_admin', restaurantId: 'rest-b' },
        query: { restaurantId: 'rest-a' }, // must be ignored: bound tenant wins
      }),
      { restaurantRepo: repo }
    );
    expect(result).toBe('rest-b');
    expect(repo.calls).toEqual(['findById:rest-b']);
  });

  it('super_admin with query restaurantId resolves the canonical id via slug/rest- prefix', async () => {
    const repo = new FakeRestaurantRepository([restaurant('rest-1', { slug: 'mi-restaurante' })]);
    const result = await resolveTenantForRequest(
      req({
        authContext: superAdmin(),
        query: { restaurantId: 'rest-mi-restaurante' },
      }),
      { restaurantRepo: repo }
    );
    // None of the bare lookups hit; the `rest-`-stripped slug resolves it.
    expect(result).toBe('rest-1');
    expect(repo.calls).toEqual([
      'findById:rest-mi-restaurante',
      'findBySlug:rest-mi-restaurante',
      'findBySlug:mi-restaurante',
    ]);
  });

  it('super_admin with body restaurantId', async () => {
    const repo = new FakeRestaurantRepository([restaurant('rest-a'), restaurant('rest-b')]);
    const result = await resolveTenantForRequest(
      req({
        authContext: superAdmin(),
        body: { restaurantId: 'rest-b' },
      }),
      { restaurantRepo: repo }
    );
    expect(result).toBe('rest-b');
  });

  it('super_admin with x-restaurant-id header', async () => {
    const repo = new FakeRestaurantRepository([restaurant('rest-a'), restaurant('rest-b')]);
    const result = await resolveTenantForRequest(
      req({
        authContext: superAdmin(),
        headers: { 'x-restaurant-id': 'rest-a' },
      }),
      { restaurantRepo: repo }
    );
    expect(result).toBe('rest-a');
  });

  it('super_admin read with no tenant falls back to the first active restaurant', async () => {
    const repo = new FakeRestaurantRepository([
      restaurant('rest-0', { isActive: false }),
      restaurant('rest-a'),
      restaurant('rest-b'),
    ]);
    const result = await resolveTenantForRequest(req({ authContext: superAdmin() }), { restaurantRepo: repo });
    expect(result).toBe('rest-a');
    expect(repo.calls[0]).toBe('findAll');
  });

  it('mutation with unresolvable tenant throws EntityNotFoundError (M7 guard)', async () => {
    const repo = new FakeRestaurantRepository([restaurant('rest-a')]);
    await expect(
      resolveTenantForRequest(
        req({ authContext: superAdmin(), body: { restaurantId: 'rest-ghost' } }),
        { restaurantRepo: repo },
        { mutation: true }
      )
    ).rejects.toBeInstanceOf(EntityNotFoundError);
    await expect(
      resolveTenantForRequest(
        req({ authContext: superAdmin(), query: { restaurantId: 'rest-ghost' } }),
        { restaurantRepo: repo },
        { mutation: true }
      )
    ).rejects.toThrow(`Restaurant 'rest-ghost' not found.`);
  });

  it('read with unresolvable tenant returns the raw id (passthrough, must NOT throw)', async () => {
    const repo = new FakeRestaurantRepository([restaurant('rest-a')]);
    const result = await resolveTenantForRequest(
      req({ authContext: superAdmin(), query: { restaurantId: 'rest-ghost' } }),
      { restaurantRepo: repo }
    );
    expect(result).toBe('rest-ghost');
  });

  it('guest (no authContext) mutation returns empty string for the caller to reject', async () => {
    const repo = new FakeRestaurantRepository([restaurant('rest-a')]);
    const result = await resolveTenantForRequest(req({}), { restaurantRepo: repo }, { mutation: true });
    expect(result).toBe('');
    expect(repo.calls).toEqual([]);
  });

  it('super_admin mutation without an explicit tenant never scans (SUS-11/JD-INFO-02)', async () => {
    const repo = new FakeRestaurantRepository([restaurant('rest-a'), restaurant('rest-b')]);
    const result = await resolveTenantForRequest(req({ authContext: superAdmin() }), { restaurantRepo: repo }, { mutation: true });
    expect(result).toBe('');
    expect(repo.calls).toEqual([]);
  });
});