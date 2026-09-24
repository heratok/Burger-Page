import { describe, it, expect } from 'vitest';
import { DeleteRestaurantUseCase } from '../../../src/application/use-cases/DeleteRestaurantUseCase.js';
import { RestaurantRepository } from '../../../src/domain/ports/out/RestaurantRepository.js';
import { Restaurant } from '../../../src/domain/models/Restaurant.js';
import { EntityNotFoundError } from '../../../src/domain/errors/DomainErrors.js';

// Hand-rolled fake (no mocking framework) for the restaurant delete use case.
// Review finding T1. Pinned mechanics: the use case does NOT cascade menu or
// product deletion and never calls hardDelete — it only forwards the resolved
// id to the repository's delete(). It resolves either by id or by slug.

class FakeRestaurantRepository implements RestaurantRepository {
  findByIdCalls: string[] = [];
  findBySlugCalls: string[] = [];
  deleteCalls: string[] = [];
  hardDeleteCalls: string[] = [];

  constructor(private readonly restaurants: Restaurant[] = []) {}

  async findById(id: string): Promise<Restaurant | null> {
    this.findByIdCalls.push(id);
    return this.restaurants.find((r) => r.id === id) ?? null;
  }

  async findBySlug(slug: string): Promise<Restaurant | null> {
    this.findBySlugCalls.push(slug);
    return this.restaurants.find((r) => r.slug === slug) ?? null;
  }

  async findAll(): Promise<Restaurant[]> {
    return [...this.restaurants];
  }

  async save(): Promise<void> {}

  async delete(id: string): Promise<void> {
    this.deleteCalls.push(id);
  }

  async hardDelete(id: string): Promise<void> {
    this.hardDeleteCalls.push(id);
  }
}

function restaurant(id: string, overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    id,
    name: id,
    slug: `slug-${id}`,
    theme: 'light',
    openingHours: { open: '09:00', close: '22:00' },
    isActive: true,
    ...overrides,
  };
}

describe('DeleteRestaurantUseCase', () => {
  it('deletes by id when the id lookup finds the restaurant', async () => {
    const repo = new FakeRestaurantRepository([restaurant('rest-1')]);
    const useCase = new DeleteRestaurantUseCase(repo);

    await useCase.execute('rest-1');

    expect(repo.findByIdCalls).toEqual(['rest-1']);
    expect(repo.findBySlugCalls).toEqual([]);
    expect(repo.deleteCalls).toEqual(['rest-1']);
  });

  it('falls back to slug lookup and deletes the resolved canonical id', async () => {
    const repo = new FakeRestaurantRepository([restaurant('rest-1', { slug: 'mi-restaurante' })]);
    const useCase = new DeleteRestaurantUseCase(repo);

    await useCase.execute('mi-restaurante');

    expect(repo.findByIdCalls).toEqual(['mi-restaurante']);
    expect(repo.findBySlugCalls).toEqual(['mi-restaurante']);
    // Deletes under the canonical restaurant id, not the slug.
    expect(repo.deleteCalls).toEqual(['rest-1']);
  });

  it('throws EntityNotFoundError when neither id nor slug matches', async () => {
    const repo = new FakeRestaurantRepository([]);
    const useCase = new DeleteRestaurantUseCase(repo);

    await expect(useCase.execute('unknown')).rejects.toThrow(EntityNotFoundError);
    expect(repo.deleteCalls).toEqual([]);
    expect(repo.hardDeleteCalls).toEqual([]);
  });
});