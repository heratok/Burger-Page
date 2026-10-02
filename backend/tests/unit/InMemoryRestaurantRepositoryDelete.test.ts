import { describe, it, expect } from 'vitest';
import { InMemoryRestaurantRepository } from '../../src/infrastructure/persistence/InMemoryRestaurantRepository.js';
import type { Restaurant } from '../../src/domain/models/Restaurant.js';

const tenant = (overrides: Partial<Restaurant> = {}): Restaurant => ({
  id: 'rest_del_1',
  slug: 'del-tenant',
  name: 'Del Tenant',
  theme: 'dark-charcoal',
  schedule: [],
  timezone: 'America/Bogota',
  ordersPaused: false,
  isActive: true,
  adminPassword: 'plain-secret-1',
  ...overrides,
});

describe('InMemoryRestaurantRepository delete semantics (parity with Pg)', () => {
  it('delete() hides the restaurant from every lookup and frees its slug', async () => {
    const repo = new InMemoryRestaurantRepository();
    await repo.save(tenant());

    await repo.delete('rest_del_1');

    expect(await repo.findById('rest_del_1')).toBeNull();
    expect(await repo.findBySlug('del-tenant')).toBeNull();
    expect((await repo.findAll()).some((r) => r.id === 'rest_del_1')).toBe(false);
  });

  it('a deleted restaurant is not resurrected by save()', async () => {
    const repo = new InMemoryRestaurantRepository();
    await repo.save(tenant());
    await repo.delete('rest_del_1');

    await repo.save(tenant());

    expect(await repo.findById('rest_del_1')).toBeNull();
  });

  it('never stores a plaintext adminPassword', async () => {
    const repo = new InMemoryRestaurantRepository();
    await repo.save(tenant());

    expect(await repo.findById('rest_del_1')).not.toHaveProperty('adminPassword');
  });
});
