import { describe, it, expect } from 'vitest';
import { UpdateRestaurantUseCase } from '../../../src/application/use-cases/UpdateRestaurantUseCase.js';
import { RestaurantRepository } from '../../../src/domain/ports/out/RestaurantRepository.js';
import { Restaurant } from '../../../src/domain/models/Restaurant.js';
import { EntityNotFoundError, ConflictError, ValidationError } from '../../../src/domain/errors/DomainErrors.js';

import { User } from '../../../src/domain/models/User.js';
import { UserRepository } from '../../../src/domain/ports/out/UserRepository.js';
import { CategoryRepository } from '../../../src/domain/ports/out/CategoryRepository.js';
import { Category } from '../../../src/domain/models/Category.js';
import { legacyHoursText, legacyOpeningHours } from '../../../src/domain/shared/restaurantSchedule.js';

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
    const idx = this.restaurants.findIndex((r) => r.id === restaurant.id);
    const stored = this.toStored(restaurant);
    if (idx >= 0) {
      this.restaurants[idx] = stored;
    } else {
      this.restaurants.push(stored);
    }
  }

  async delete(): Promise<void> {}

  /** Hook for fakes that, like the Pg adapter, normalize what they persist. */
  protected toStored(restaurant: Restaurant): Restaurant {
    return restaurant;
  }
}

// Mirrors PgRestaurantRepository: the weekly schedule is the single stored
// source and the legacy openingHours / config.openingHours text are derived
// from it on read (the config text is never persisted).
class HoursNormalizingRestaurantRepository extends FakeRestaurantRepository {
  protected toStored(restaurant: Restaurant): Restaurant {
    const openingHours = legacyOpeningHours(restaurant.schedule, restaurant.timezone);
    return {
      ...restaurant,
      openingHours,
      config: { ...restaurant.config, openingHours: legacyHoursText(openingHours) },
    };
  }
}

const allWeek = (open: string, close: string) =>
  [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, open, close }));

function restaurant(overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    id: 'rest-1',
    slug: 'mi-restaurante',
    name: 'Mi Restaurante',
    theme: 'light',
    schedule: allWeek('09:00', '22:00'),
    timezone: 'America/Bogota',
    ordersPaused: false,
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
    ).rejects.toThrow(ConflictError);
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

  it('returns the persisted restaurant, so derived openingHours match the saved schedule', async () => {
    const repo = new HoursNormalizingRestaurantRepository([restaurant()]);
    const useCase = new UpdateRestaurantUseCase(repo);

    const result = await useCase.execute(
      'rest-1',
      { schedule: allWeek('11:00', '23:00') },
      'restaurant_admin'
    );

    expect(result.config?.openingHours).toBe('11:00 - 23:00');
    expect(result.openingHours).toEqual({ open: '11:00', close: '23:00' });
    expect(result).not.toHaveProperty('adminPassword');
  });

  describe('schedule, timezone and ordersPaused (store-opening-hours T2)', () => {
    const weekly = [
      { dayOfWeek: 1, open: '12:00', close: '14:00' },
      { dayOfWeek: 1, open: '19:00', close: '02:00' },
    ];

    it('lets a tenant admin change schedule, timezone and the paused flag, and saves them', async () => {
      const repo = new HoursNormalizingRestaurantRepository([restaurant()]);
      const useCase = new UpdateRestaurantUseCase(repo);

      const result = await useCase.execute(
        'rest-1',
        { schedule: weekly, timezone: 'America/Mexico_City', ordersPaused: true },
        'restaurant_admin'
      );

      expect(repo.saveCalls[0].schedule).toEqual(weekly);
      expect(repo.saveCalls[0].timezone).toBe('America/Mexico_City');
      expect(repo.saveCalls[0].ordersPaused).toBe(true);
      expect(result.schedule).toEqual(weekly);
      expect(result.ordersPaused).toBe(true);
    });

    it('keeps the stored schedule, timezone and paused flag on a partial update', async () => {
      const repo = new FakeRestaurantRepository([restaurant({ ordersPaused: true, timezone: 'America/Lima' })]);
      const useCase = new UpdateRestaurantUseCase(repo);

      await useCase.execute('rest-1', { name: 'Renamed' }, 'restaurant_admin');

      expect(repo.saveCalls[0].schedule).toEqual(allWeek('09:00', '22:00'));
      expect(repo.saveCalls[0].timezone).toBe('America/Lima');
      expect(repo.saveCalls[0].ordersPaused).toBe(true);
    });

    it('can clear the schedule (closed every day) and unpause', async () => {
      const repo = new FakeRestaurantRepository([restaurant({ ordersPaused: true })]);
      const useCase = new UpdateRestaurantUseCase(repo);

      await useCase.execute('rest-1', { schedule: [], ordersPaused: false }, 'restaurant_admin');

      expect(repo.saveCalls[0].schedule).toEqual([]);
      expect(repo.saveCalls[0].ordersPaused).toBe(false);
    });

    it('rejects an invalid timezone, weekday, time or duplicated range without saving', async () => {
      const repo = new FakeRestaurantRepository([restaurant()]);
      const useCase = new UpdateRestaurantUseCase(repo);

      await expect(useCase.execute('rest-1', { timezone: 'Mars/Olympus' }, 'restaurant_admin')).rejects.toThrow(ValidationError);
      await expect(
        useCase.execute('rest-1', { schedule: [{ dayOfWeek: 8, open: '09:00', close: '17:00' }] }, 'restaurant_admin')
      ).rejects.toThrow(ValidationError);
      await expect(
        useCase.execute('rest-1', { schedule: [{ dayOfWeek: 1, open: '9am', close: '17:00' }] }, 'restaurant_admin')
      ).rejects.toThrow(ValidationError);
      await expect(
        useCase.execute(
          'rest-1',
          {
            schedule: [
              { dayOfWeek: 1, open: '09:00', close: '12:00' },
              { dayOfWeek: 1, open: '09:00', close: '15:00' },
            ],
          },
          'restaurant_admin'
        )
      ).rejects.toThrow(ValidationError);
      expect(repo.saveCalls).toHaveLength(0);
    });

    describe('legacy config.openingHours text from an older admin client', () => {
      it('a parseable "HH:MM - HH:MM" text different from the current hours applies to every weekday', async () => {
        const repo = new HoursNormalizingRestaurantRepository([restaurant()]);
        const useCase = new UpdateRestaurantUseCase(repo);

        const result = await useCase.execute('rest-1', { config: { openingHours: '11:00 - 23:00' } }, 'restaurant_admin');

        expect(repo.saveCalls[0].schedule).toEqual(allWeek('11:00', '23:00'));
        expect(result.config?.openingHours).toBe('11:00 - 23:00');
        expect(result.openingHours).toEqual({ open: '11:00', close: '23:00' });
      });

      it('echoing the derived text (full-config save) never overwrites a weekly schedule', async () => {
        const weeklySchedule = [
          { dayOfWeek: 1, open: '09:00', close: '17:00' },
          { dayOfWeek: 5, open: '18:00', close: '23:00' },
        ];
        const stored = restaurant({ schedule: weeklySchedule });
        const repo = new HoursNormalizingRestaurantRepository([stored]);
        const useCase = new UpdateRestaurantUseCase(repo);
        const current = await repo.findById('rest-1');

        await useCase.execute('rest-1', { config: { openingHours: current?.config?.openingHours } }, 'restaurant_admin');

        expect(repo.saveCalls[0].schedule).toEqual(weeklySchedule);
      });

      it('an explicit schedule wins over a legacy text sent in the same request', async () => {
        const repo = new HoursNormalizingRestaurantRepository([restaurant()]);
        const useCase = new UpdateRestaurantUseCase(repo);

        await useCase.execute(
          'rest-1',
          { schedule: weekly, config: { openingHours: '08:00 - 20:00' } },
          'restaurant_admin'
        );

        expect(repo.saveCalls[0].schedule).toEqual(weekly);
      });

      it('a free-form text is ignored and keeps the stored schedule', async () => {
        const repo = new FakeRestaurantRepository([restaurant()]);
        const useCase = new UpdateRestaurantUseCase(repo);

        await useCase.execute('rest-1', { config: { openingHours: 'Mar - Dom: 12:00 PM - 10:30 PM' } }, 'restaurant_admin');

        expect(repo.saveCalls[0].schedule).toEqual(allWeek('09:00', '22:00'));
      });
    });
  });
});

// A super admin's adminPassword reaches the real login (the admin user's
// hash), never the restaurant record.
describe('UpdateRestaurantUseCase admin password reset', () => {
  const adminUser = (overrides: Partial<User> = {}): User => ({
    id: 'usr-1',
    username: 'admin_mi-restaurante',
    passwordHash: 'old-hash',
    role: 'restaurant_admin',
    restaurantId: 'rest-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    isActive: true,
    ...overrides,
  });

  const fakeUserRepo = (users: User[]) => {
    const saved: Array<{ user: User; actorRole?: string }> = [];
    const repo = {
      findById: async (id: string) => users.find((u) => u.id === id) ?? null,
      findByUsername: async (n: string) => users.find((u) => u.username === n) ?? null,
      findByRestaurantId: async (rid: string) => users.filter((u) => u.restaurantId === rid),
      findAll: async () => users,
      save: async (user: User, actorRole?: string) => {
        saved.push({ user, actorRole });
      },
      delete: async () => {},
    } as unknown as UserRepository;
    return { repo, saved };
  };
  const hasher = { hash: async (p: string) => `hashed:${p}`, verify: async () => true };

  it('rehashes the admin user, forces a password change and persists no plaintext', async () => {
    const restRepo = new FakeRestaurantRepository([restaurant()]);
    const { repo: userRepo, saved } = fakeUserRepo([adminUser()]);
    const useCase = new UpdateRestaurantUseCase(restRepo, undefined, userRepo, hasher);

    const result = await useCase.execute('rest-1', { adminPassword: 'fresh-secret-9' }, 'super_admin');

    expect(saved).toHaveLength(1);
    expect(saved[0].user.passwordHash).toBe('hashed:fresh-secret-9');
    expect(saved[0].user.mustChangePassword).toBe(true);
    expect(Number.isNaN(Date.parse(saved[0].user.passwordChangedAt ?? ''))).toBe(false);
    expect(saved[0].actorRole).toBe('super_admin');
    expect(restRepo.saveCalls[0]).not.toHaveProperty('adminPassword');
    expect(result).not.toHaveProperty('adminPassword');
  });

  it('resets only the primary (earliest created) admin when the tenant has several', async () => {
    const restRepo = new FakeRestaurantRepository([restaurant()]);
    const { repo: userRepo, saved } = fakeUserRepo([
      adminUser({ id: 'usr-2', username: 'second', createdAt: '2026-03-01T00:00:00.000Z' }),
      adminUser({ id: 'usr-1' }),
    ]);
    const useCase = new UpdateRestaurantUseCase(restRepo, undefined, userRepo, hasher);

    await useCase.execute('rest-1', { adminPassword: 'fresh-secret-9' }, 'super_admin');

    expect(saved.map((s) => s.user.id)).toEqual(['usr-1']);
  });

  it('rejects a password shorter than 8 characters and changes nothing', async () => {
    const restRepo = new FakeRestaurantRepository([restaurant()]);
    const { repo: userRepo, saved } = fakeUserRepo([adminUser()]);
    const useCase = new UpdateRestaurantUseCase(restRepo, undefined, userRepo, hasher);

    await expect(useCase.execute('rest-1', { adminPassword: 'short' }, 'super_admin')).rejects.toThrow(
      ValidationError
    );
    expect(saved).toHaveLength(0);
    expect(restRepo.saveCalls).toHaveLength(0);
  });

  it('fails with not found, saving nothing, when the tenant has no admin user', async () => {
    const restRepo = new FakeRestaurantRepository([restaurant()]);
    const { repo: userRepo } = fakeUserRepo([]);
    const useCase = new UpdateRestaurantUseCase(restRepo, undefined, userRepo, hasher);

    await expect(
      useCase.execute('rest-1', { adminPassword: 'fresh-secret-9' }, 'super_admin')
    ).rejects.toThrow(EntityNotFoundError);
    expect(restRepo.saveCalls).toHaveLength(0);
  });

  it('strips a legacy plaintext adminPassword already on the stored record', async () => {
    const restRepo = new FakeRestaurantRepository([restaurant({ adminPassword: 'legacy-plain' })]);
    const useCase = new UpdateRestaurantUseCase(restRepo);

    await useCase.execute('rest-1', { name: 'Nuevo' }, 'super_admin');

    expect(restRepo.saveCalls[0]).not.toHaveProperty('adminPassword');
  });
});
