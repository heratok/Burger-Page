import { describe, it, expect } from 'vitest';
import { UpdateRestaurantUseCase } from '../../../src/application/use-cases/UpdateRestaurantUseCase.js';
import { RestaurantRepository } from '../../../src/domain/ports/out/RestaurantRepository.js';
import { Restaurant } from '../../../src/domain/models/Restaurant.js';
import { EntityNotFoundError, ValidationError } from '../../../src/domain/errors/DomainErrors.js';

import { CategoryRepository } from '../../../src/domain/ports/out/CategoryRepository.js';
import { Category } from '../../../src/domain/models/Category.js';

// S3: slug, isActive and adminPassword are super_admin-only fields on PUT,
// enforced with an effective-change rule. The tenant-admin frontend save path
// sends slug (and sometimes isActive) on every PUT, so an idempotent no-op
// (same value as currently stored) must keep working; only an EFFECTIVE change
// is rejected, and adminPassword is rejected on ANY presence.
// Hand-rolled fakes (no mocking framework), matching the repo's existing
// use-case unit test style.

class FakeCategoryRepository implements CategoryRepository {
  savedCategories: Category[] = [];
  categories: Category[] = [];

  constructor(initial: Category[] = []) {
    this.categories = [...initial];
  }

  async findById(id: string, restaurantId: string): Promise<Category | null> {
    return this.categories.find((c) => c.id === id && c.restaurantId === restaurantId) ?? null;
  }
  async findByRestaurantId(restaurantId: string): Promise<Category[]> {
    return this.categories.filter((c) => c.restaurantId === restaurantId);
  }
  async findByName(name: string, restaurantId: string): Promise<Category | null> {
    return this.categories.find((c) => c.name.toLowerCase() === name.toLowerCase() && c.restaurantId === restaurantId) ?? null;
  }
  async save(category: Category): Promise<void> {
    this.savedCategories.push(category);
    const idx = this.categories.findIndex((c) => c.id === category.id);
    if (idx >= 0) {
      this.categories[idx] = category;
    } else {
      this.categories.push(category);
    }
  }
  async delete(id: string, restaurantId: string): Promise<void> {
    this.categories = this.categories.filter((c) => !(c.id === id && c.restaurantId === restaurantId));
  }
}

class FakeRestaurantRepository implements RestaurantRepository {
  findByIdCalls: string[] = [];
  findBySlugCalls: string[] = [];
  saveCalls: Restaurant[] = [];

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

  async save(restaurant: Restaurant): Promise<void> {
    this.saveCalls.push(restaurant);
  }

  async delete(): Promise<void> {}
}

function restaurant(overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    id: 'rest-1',
    slug: 'mi-restaurante',
    name: 'Mi Restaurante',
    theme: 'light',
    openingHours: { open: '09:00', close: '22:00' },
    isActive: true,
    categories: ['Pizza'],
    ...overrides,
  };
}

describe('UpdateRestaurantUseCase', () => {
  it('tenant admin sending the SAME slug is a no-op and succeeds (frontend save path)', async () => {
    const repo = new FakeRestaurantRepository([restaurant()]);
    const useCase = new UpdateRestaurantUseCase(repo);

    const result = await useCase.execute('rest-1', { slug: 'mi-restaurante' }, 'restaurant_admin');

    expect(repo.saveCalls).toHaveLength(1);
    expect(repo.saveCalls[0].slug).toBe('mi-restaurante');
    expect(result.slug).toBe('mi-restaurante');
  });

  it('rejects an EFFECTIVE slug change from a tenant admin and never saves', async () => {
    const repo = new FakeRestaurantRepository([restaurant()]);
    const useCase = new UpdateRestaurantUseCase(repo);

    await expect(
      useCase.execute('rest-1', { slug: 'mi-nuevo-slug' } as any, 'restaurant_admin')
    ).rejects.toThrow(ValidationError);
    await expect(
      useCase.execute('rest-1', { slug: 'mi-nuevo-slug' } as any, 'restaurant_admin')
    ).rejects.toThrow(/super_admin/);
    expect(repo.saveCalls).toEqual([]);
  });

  it('tenant admin sending the SAME isActive is a no-op and succeeds', async () => {
    const repo = new FakeRestaurantRepository([restaurant()]);
    const useCase = new UpdateRestaurantUseCase(repo);

    const result = await useCase.execute('rest-1', { isActive: true }, 'restaurant_admin');

    expect(repo.saveCalls).toHaveLength(1);
    expect(repo.saveCalls[0].isActive).toBe(true);
    expect(result.isActive).toBe(true);
  });

  it('rejects an EFFECTIVE isActive change from a tenant admin (no role or restaurant_admin) and never saves', async () => {
    const repo = new FakeRestaurantRepository([restaurant()]);
    const useCase = new UpdateRestaurantUseCase(repo);

    await expect(
      useCase.execute('rest-1', { isActive: false } as any, undefined)
    ).rejects.toThrow(ValidationError);
    await expect(
      useCase.execute('rest-1', { isActive: false } as any, undefined)
    ).rejects.toThrow(/super_admin/);
    await expect(
      useCase.execute('rest-1', { isActive: false } as any, 'restaurant_admin')
    ).rejects.toThrow(ValidationError);
    expect(repo.saveCalls).toEqual([]);
  });

  it('rejects adminPassword from a tenant admin on ANY presence and never saves', async () => {
    const repo = new FakeRestaurantRepository([restaurant()]);
    const useCase = new UpdateRestaurantUseCase(repo);

    await expect(
      useCase.execute('rest-1', { adminPassword: 'fresh-secret-9' } as any, 'restaurant_admin')
    ).rejects.toThrow(ValidationError);
    await expect(
      useCase.execute('rest-1', { adminPassword: 'fresh-secret-9' } as any, 'restaurant_admin')
    ).rejects.toThrow(/super_admin/);
    // Even a value matching the stored plaintext cannot be compared to the
    // hash, so any presence is rejected.
    await expect(
      useCase.execute('rest-1', { adminPassword: 'evergreen-secret' } as any, 'restaurant_admin')
    ).rejects.toThrow(ValidationError);
    expect(repo.saveCalls).toEqual([]);
  });

  it('allows legitimate tenant fields from a tenant admin (config update unaffected)', async () => {
    const repo = new FakeRestaurantRepository([restaurant()]);
    const useCase = new UpdateRestaurantUseCase(repo);

    const result = await useCase.execute('rest-1', { config: { logoUrl: 'https://x/logo.png' } }, 'restaurant_admin');

    expect(repo.saveCalls).toHaveLength(1);
    expect(repo.saveCalls[0].config.logoUrl).toBe('https://x/logo.png');
    expect(result.config.logoUrl).toBe('https://x/logo.png');
  });

  it('allows isActive and slug changes from a super_admin and saves', async () => {
    const repo = new FakeRestaurantRepository([restaurant()]);
    const useCase = new UpdateRestaurantUseCase(repo);

    const result = await useCase.execute(
      'rest-1',
      { isActive: false, slug: 'Mi Restaurante!' } as any,
      'super_admin'
    );

    expect(repo.saveCalls).toHaveLength(1);
    expect(repo.saveCalls[0]).toMatchObject({ id: 'rest-1', isActive: false, slug: 'mi-restaurante-' });
    expect(result.isActive).toBe(false);
    expect(result.slug).toBe('mi-restaurante-');
  });

  it('normalizes slug input and rejects duplicates (unchanged behavior)', async () => {
    const repo = new FakeRestaurantRepository([
      restaurant(),
      restaurant({ id: 'rest-2', slug: 'tomado' }),
    ]);
    const useCase = new UpdateRestaurantUseCase(repo);

    // Normalization: uppercase/space collapse into the dashed slug and
    // non-alphanumerics become '-' (trailing separators are kept by the
    // existing implementation — pinned, not "fixed").
    const normalized = await useCase.execute(
      'rest-1',
      { slug: '  Mi VIEJO Slug!! ' } as any,
      'super_admin'
    );
    expect(normalized.slug).toBe('mi-viejo-slug-');

    // Duplicate rejection still applies for super_admin too.
    await expect(
      useCase.execute('rest-1', { slug: 'tomado' } as any, 'super_admin')
    ).rejects.toThrow(ValidationError);
    await expect(
      useCase.execute('rest-1', { slug: 'tomado' } as any, 'super_admin')
    ).rejects.toThrow(/already exists/);
    expect(repo.saveCalls).toHaveLength(1);
  });

  it('throws EntityNotFoundError when neither id nor slug resolves (resolution precedes the role guard)', async () => {
    const repo = new FakeRestaurantRepository([]);
    const useCase = new UpdateRestaurantUseCase(repo);

    await expect(useCase.execute('unknown', { name: 'X' } as any, 'restaurant_admin')).rejects.toThrow(
      EntityNotFoundError
    );
    // Slug guard never runs against a nonexistent restaurant tried as a slug change.
    await expect(
      useCase.execute('unknown', { slug: 'x' } as any, 'restaurant_admin')
    ).rejects.toThrow(EntityNotFoundError);
    expect(repo.saveCalls).toEqual([]);
  });

  it('synchronizes categories into CategoryRepository when input.categories is provided', async () => {
    const repo = new FakeRestaurantRepository([restaurant()]);
    const catRepo = new FakeCategoryRepository([
      { id: 'cat-1', restaurantId: 'rest-1', name: 'Pizza', isActive: true, displayOrder: 0 },
      { id: 'cat-2', restaurantId: 'rest-1', name: 'Bebidas', isActive: true, displayOrder: 1 },
    ]);
    const useCase = new UpdateRestaurantUseCase(repo, catRepo);

    await useCase.execute('rest-1', { categories: ['Pizza', 'Postres'] }, 'restaurant_admin');

    // Should have saved 'Pizza' (kept active), 'Postres' (created active), and 'Bebidas' (deactivated)
    expect(catRepo.savedCategories.length).toBeGreaterThan(0);
    const activeCats = catRepo.categories.filter((c) => c.isActive);
    expect(activeCats.map((c) => c.name)).toEqual(['Pizza', 'Postres']);
    const deactivated = catRepo.categories.filter((c) => !c.isActive);
    expect(deactivated.map((c) => c.name)).toEqual(['Bebidas']);
  });
});