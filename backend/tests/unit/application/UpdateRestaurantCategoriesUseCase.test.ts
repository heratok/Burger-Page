import { describe, it, expect } from 'vitest';
import { UpdateRestaurantCategoriesUseCase } from '../../../src/application/use-cases/UpdateRestaurantCategoriesUseCase.js';
import { RestaurantRepository } from '../../../src/domain/ports/out/RestaurantRepository.js';
import { CategoryRepository } from '../../../src/domain/ports/out/CategoryRepository.js';
import { ProductRepository } from '../../../src/domain/ports/out/ProductRepository.js';
import { Restaurant } from '../../../src/domain/models/Restaurant.js';
import { Category } from '../../../src/domain/models/Category.js';
import { Product } from '../../../src/domain/models/Product.js';
import { EntityNotFoundError } from '../../../src/domain/errors/DomainErrors.js';

// Hand-rolled fakes (no mocking framework) for the restaurant categories use
// case. Review finding T1. Pinned behaviors: category cleanup is trim +
// dedupe (first-occurrence casing wins), the category repository is OPTIONAL
// and its failures are swallowed (warned, not propagated), and the use case
// does NOT validate empty categories — an empty input deactivates everything.

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

class FakeCategoryRepository implements CategoryRepository {
  findByRestaurantIdCalls: string[] = [];
  saveCalls: Category[] = [];

  constructor(private readonly existing: Category[] = []) {}

  async findById(): Promise<Category | null> {
    return null;
  }

  async findByRestaurantId(restaurantId: string): Promise<Category[]> {
    this.findByRestaurantIdCalls.push(restaurantId);
    return this.existing;
  }

  async findByName(): Promise<Category | null> {
    return null;
  }

  async save(category: Category): Promise<void> {
    this.saveCalls.push(category);
  }

  async delete(): Promise<void> {}
}

class FakeProductRepository implements ProductRepository {
  findByRestaurantIdCalls: string[] = [];
  saveCalls: Product[] = [];

  constructor(private readonly products: Product[] = []) {}

  async findById(): Promise<Product | null> {
    return null;
  }

  async findByRestaurantId(restaurantId: string): Promise<Product[]> {
    this.findByRestaurantIdCalls.push(restaurantId);
    return [...this.products];
  }

  async countByRestaurantId(): Promise<number> {
    return this.products.length;
  }

  async save(product: Product): Promise<void> {
    this.saveCalls.push(product);
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

describe('UpdateRestaurantCategoriesUseCase', () => {
  it('resolves by slug, saves the cleaned categories and returns the updated restaurant', async () => {
    const repo = new FakeRestaurantRepository([restaurant()]);
    const useCase = new UpdateRestaurantCategoriesUseCase(repo);

    const result = await useCase.execute('mi-restaurante', ['Pizza', 'Burgers']);

    expect(repo.findBySlugCalls).toEqual(['mi-restaurante']);
    expect(repo.findByIdCalls).toEqual([]);
    expect(repo.saveCalls).toHaveLength(1);
    expect(repo.saveCalls[0]).toMatchObject({ id: 'rest-1', categories: ['Pizza', 'Burgers'] });
    expect(result).toMatchObject({ id: 'rest-1', categories: ['Pizza', 'Burgers'] });
  });

  it('trims and deduplicates categories by exact string, dropping empty entries', async () => {
    const repo = new FakeRestaurantRepository([restaurant()]);
    const useCase = new UpdateRestaurantCategoriesUseCase(repo);

    const result = await useCase.execute('mi-restaurante', ['  Pizza ', 'Pizza', 'Burgers', '', '   ']);

    // Dedupe is case-SENSITIVE: Set dedupes on the exact trimmed string, so
    // 'Pizza' and 'pizza' would both survive; whitespace-only entries drop out.
    expect(repo.saveCalls[0].categories).toEqual(['Pizza', 'Burgers']);
    expect(result.categories).toEqual(['Pizza', 'Burgers']);
  });

  it('falls back to id lookup when the slug does not resolve', async () => {
    const repo = new FakeRestaurantRepository([restaurant()]);
    const useCase = new UpdateRestaurantCategoriesUseCase(repo);

    await useCase.execute('rest-1', ['Pizza']);

    expect(repo.findBySlugCalls).toEqual(['rest-1']);
    expect(repo.findByIdCalls).toEqual(['rest-1']);
    expect(repo.saveCalls[0].id).toBe('rest-1');
  });

  it('throws EntityNotFoundError when neither slug nor id resolves', async () => {
    const repo = new FakeRestaurantRepository([]);
    const useCase = new UpdateRestaurantCategoriesUseCase(repo);

    await expect(useCase.execute('unknown', ['Pizza'])).rejects.toThrow(EntityNotFoundError);
    expect(repo.saveCalls).toEqual([]);
  });

  it('creates, updates and deactivates categories through the category repository', async () => {
    const restaurantRepo = new FakeRestaurantRepository([restaurant()]);
    const categoryRepo = new FakeCategoryRepository([
      { id: 'cat-1', restaurantId: 'rest-1', name: 'Pizza', displayOrder: 0, isActive: true },
      { id: 'cat-2', restaurantId: 'rest-1', name: 'Postres', displayOrder: 1, isActive: true },
    ]);
    const useCase = new UpdateRestaurantCategoriesUseCase(restaurantRepo, categoryRepo);

    const result = await useCase.execute('mi-restaurante', ['PIZZA', 'Nuevas']);

    expect(categoryRepo.findByRestaurantIdCalls).toEqual(['rest-1']);
    // 1) Existing 'Pizza' matched case-insensitively, kept id, new displayOrder.
    expect(categoryRepo.saveCalls[0]).toEqual({
      id: 'cat-1',
      restaurantId: 'rest-1',
      name: 'PIZZA',
      displayOrder: 0,
      isActive: true,
    });
    // 2) New category gets a generated cat_ id and the running displayOrder.
    expect(categoryRepo.saveCalls[1]).toMatchObject({
      restaurantId: 'rest-1',
      name: 'Nuevas',
      displayOrder: 1,
      isActive: true,
    });
    expect(categoryRepo.saveCalls[1].id.startsWith('cat_')).toBe(true);
    // 3) 'Postres' is no longer in the cleaned set, so it is deactivated.
    expect(categoryRepo.saveCalls[2]).toEqual({
      id: 'cat-2',
      restaurantId: 'rest-1',
      name: 'Postres',
      displayOrder: 1,
      isActive: false,
    });
    expect(result.categories).toEqual(['PIZZA', 'Nuevas']);
  });

  it('swallows category repository failures but still returns the updated restaurant', async () => {
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      const restaurantRepo = new FakeRestaurantRepository([restaurant()]);
      const failingCategoryRepo = new FakeCategoryRepository();
      failingCategoryRepo.findByRestaurantId = async () => {
        throw new Error('db down');
      };
      failingCategoryRepo.save = async () => {
        throw new Error('db down');
      };
      const useCase = new UpdateRestaurantCategoriesUseCase(restaurantRepo, failingCategoryRepo);

      const result = await useCase.execute('mi-restaurante', ['Pizza']);

      // The restaurant itself was still persisted before the sync attempt.
      expect(restaurantRepo.saveCalls).toHaveLength(1);
      expect(result.categories).toEqual(['Pizza']);
    } finally {
      console.warn = originalWarn;
    }
  });

  it('does not validate empty categories: saves an empty list and deactivates every active category', async () => {
    const restaurantRepo = new FakeRestaurantRepository([restaurant()]);
    const categoryRepo = new FakeCategoryRepository([
      { id: 'cat-1', restaurantId: 'rest-1', name: 'Pizza', displayOrder: 0, isActive: true },
      { id: 'cat-2', restaurantId: 'rest-1', name: 'Postres', displayOrder: 1, isActive: false },
    ]);
    const useCase = new UpdateRestaurantCategoriesUseCase(restaurantRepo, categoryRepo);

    const result = await useCase.execute('mi-restaurante', ['   ', '']);

    // No ValidationError: empty categories are legal input here.
    expect(restaurantRepo.saveCalls[0].categories).toEqual([]);
    // Only the ACTIVE category is deactivated; 'Postres' was already inactive.
    expect(categoryRepo.saveCalls).toHaveLength(1);
    expect(categoryRepo.saveCalls[0]).toEqual({
      id: 'cat-1',
      restaurantId: 'rest-1',
      name: 'Pizza',
      displayOrder: 0,
      isActive: false,
    });
    expect(result.categories).toEqual([]);
  });

  it('reassigns products belonging to deactivated categories to the fallback category', async () => {
    const restaurantRepo = new FakeRestaurantRepository([restaurant()]);
    const categoryRepo = new FakeCategoryRepository([
      { id: 'cat-1', restaurantId: 'rest-1', name: 'Pizza', displayOrder: 0, isActive: true },
      { id: 'cat-2', restaurantId: 'rest-1', name: 'Postres', displayOrder: 1, isActive: true },
    ]);
    const productRepo = new FakeProductRepository([
      {
        id: 'prod-1',
        restaurantId: 'rest-1',
        name: 'Tiramisu',
        description: 'Dulce',
        price: 5000,
        category: 'Postres',
        categoryId: 'cat-2',
        isAvailable: true,
        isPopular: false,
        isNew: false,
        preparationTimeMinutes: 10,
        displayOrder: 0,
        additions: [],
      },
      {
        id: 'prod-2',
        restaurantId: 'rest-1',
        name: 'Margarita',
        description: 'Pizza',
        price: 15000,
        category: 'Pizza',
        categoryId: 'cat-1',
        isAvailable: true,
        isPopular: false,
        isNew: false,
        preparationTimeMinutes: 15,
        displayOrder: 0,
        additions: [],
      },
    ]);

    const useCase = new UpdateRestaurantCategoriesUseCase(restaurantRepo, categoryRepo, productRepo);

    await useCase.execute('mi-restaurante', ['Pizza']);

    // 'Postres' was deactivated, so prod-1 should be reassigned to fallback category ('Pizza', cat-1)
    expect(productRepo.saveCalls).toHaveLength(1);
    expect(productRepo.saveCalls[0]).toMatchObject({
      id: 'prod-1',
      category: 'Pizza',
      categoryId: 'cat-1',
    });
  });
});