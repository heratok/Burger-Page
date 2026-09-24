import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RestaurantRepository } from '../../src/domain/ports/out/RestaurantRepository.js';
import { CategoryRepository } from '../../src/domain/ports/out/CategoryRepository.js';
import { ListRestaurantsUseCase } from '../../src/application/use-cases/ListRestaurantsUseCase.js';
import { GetRestaurantUseCase } from '../../src/application/use-cases/GetRestaurantUseCase.js';
import { UpdateRestaurantUseCase } from '../../src/application/use-cases/UpdateRestaurantUseCase.js';
import { CreateRestaurantUseCase } from '../../src/application/use-cases/CreateRestaurantUseCase.js';
import { Restaurant } from '../../src/domain/models/Restaurant.js';

// SUS-20: the one-time admin password legitimately appears ONLY in the 201
// create response. Every read path (list/get/update) must redact it, even
// when the underlying repository still holds it (e.g. in-memory adapters or
// future regressions).

function restaurantWithSecret(id: string, overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    id,
    slug: `slug-${id}`,
    name: 'Rosto',
    adminPassword: 'top-secret-42',
    theme: 'dark-charcoal',
    openingHours: { open: '12:00', close: '22:30' },
    isActive: true,
    ...overrides,
  };
}

function mockRepo(): RestaurantRepository {
  return {
    findById: vi.fn(),
    findBySlug: vi.fn(),
    findAll: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  } as any;
}

describe('SUS-20 read paths never expose adminPassword (Seam C)', () => {
  let repo: RestaurantRepository;

  beforeEach(() => {
    repo = mockRepo();
  });

  it('list responses contain no adminPassword even when the repo holds it', async () => {
    (repo.findAll as any).mockResolvedValue([
      restaurantWithSecret('rest-1'),
      restaurantWithSecret('rest-2', { adminPassword: 'another-secret' }),
    ]);

    const result = await new ListRestaurantsUseCase(repo).execute();

    expect(result).toHaveLength(2);
    for (const r of result) {
      expect((r as any).adminPassword).toBeUndefined();
    }
    // Redaction must not strip legitimate fields.
    expect(result[0].name).toBe('Rosto');
    expect(result[0].isActive).toBe(true);
  });

  it('get responses contain no adminPassword (id fallback path)', async () => {
    (repo.findBySlug as any).mockResolvedValue(null);
    (repo.findById as any).mockResolvedValue(restaurantWithSecret('rest-1'));

    const result = await new GetRestaurantUseCase(repo).execute('rest-1');

    expect(result.id).toBe('rest-1');
    expect((result as any).adminPassword).toBeUndefined();
    expect(result.name).toBe('Rosto');
  });

  it('TRIANGULATE: get with category enrichment is also redacted', async () => {
    (repo.findBySlug as any).mockResolvedValue(restaurantWithSecret('rest-1'));
    const categoryRepo = {
      findByRestaurantId: vi.fn().mockResolvedValue([{ name: 'Postres', isActive: true }]),
    } as unknown as CategoryRepository;

    const result = await new GetRestaurantUseCase(repo, categoryRepo).execute('rest-1');

    expect(result.categories).toEqual(['Postres']);
    expect((result as any).adminPassword).toBeUndefined();
  });

  it('create responses DO carry the one-time credentials (the 201 boundary)', async () => {
    (repo.findBySlug as any).mockResolvedValue(null);
    const useCase = new CreateRestaurantUseCase(
      repo as any,
      undefined as unknown as CategoryRepository
    );

    const created = await useCase.execute({ name: 'Rosto', slug: 'rosto' } as any);

    expect(created.adminPassword).toBeDefined();
    expect((created as any).adminUsername).toBeDefined();
    expect(created.adminPassword!.length).toBeGreaterThanOrEqual(12);
  });
});

describe('SUS-20 update responses never echo adminPassword (Seam D)', () => {
  let repo: RestaurantRepository;

  beforeEach(() => {
    repo = mockRepo();
  });

  it('does not echo a newly provided adminPassword while keeping update semantics', async () => {
    (repo.findById as any).mockResolvedValue(restaurantWithSecret('rest-1'));

    // S3: credential rotation is super_admin-only (a tenant admin sending the
    // same plaintext cannot be compared to the stored hash), so this update
    // runs as super_admin — the genuine assertion is that the provided
    // password is never echoed back in the response.
    const updated = await new UpdateRestaurantUseCase(repo).execute(
      'rest-1',
      {
        name: 'Rosto V2',
        adminPassword: 'fresh-secret-7',
      } as any,
      'super_admin'
    );

    // Response is redacted: the plaintext never leaves the server again.
    expect((updated as any).adminPassword).toBeUndefined();
    // Update semantics are preserved: fields apply and the change is saved.
    expect(updated.name).toBe('Rosto V2');
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('does not invent an adminPassword field when none was provided', async () => {
    (repo.findById as any).mockResolvedValue(restaurantWithSecret('rest-1', { adminPassword: undefined }));

    const updated = await new UpdateRestaurantUseCase(repo).execute('rest-1', {
      tagline: 'Nueva frase',
    } as any);

    expect((updated as any).adminPassword).toBeUndefined();
    expect(updated.tagline).toBe('Nueva frase');
    expect(repo.save).toHaveBeenCalledTimes(1);
  });
});