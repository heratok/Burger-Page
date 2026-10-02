import { describe, it, expect } from 'vitest';
import { CreateRestaurantUseCase } from '../../../src/application/use-cases/CreateRestaurantUseCase.js';
import { UpdateRestaurantUseCase } from '../../../src/application/use-cases/UpdateRestaurantUseCase.js';
import { InMemoryRestaurantRepository } from '../../../src/infrastructure/persistence/InMemoryRestaurantRepository.js';
import { Restaurant } from '../../../src/domain/models/Restaurant.js';
import { ConflictError, ValidationError } from '../../../src/domain/errors/DomainErrors.js';

/**
 * Mirrors PgRestaurantRepository.findBySlug: that lookup is the public
 * storefront read and under RLS only ever sees ACTIVE tenants, so a paused
 * tenant owning the slug is invisible to it. slugExists must still see it.
 */
class RlsLikeRestaurantRepository extends InMemoryRestaurantRepository {
  override async findBySlug(slug: string): Promise<Restaurant | null> {
    const found = await super.findBySlug(slug);
    return found && found.isActive ? found : null;
  }
}

async function withPausedTenant() {
  const repo = new RlsLikeRestaurantRepository();
  const base = (await repo.findById('tenant-a'))!;
  await repo.save({ ...base, id: 'paused-one', slug: 'paused-slug', isActive: false });
  return repo;
}

describe('slug collisions with a paused (non-public) tenant', () => {
  it('create answers a ConflictError instead of reaching the unique index', async () => {
    const repo = await withPausedTenant();
    const useCase = new CreateRestaurantUseCase(repo);
    await expect(useCase.execute({ name: 'Nuevo', slug: 'paused-slug' })).rejects.toThrow(ConflictError);
    expect(await repo.findById('paused-one')).not.toBeNull();
  });

  it('update answers a ConflictError when the target slug belongs to a paused tenant', async () => {
    const repo = await withPausedTenant();
    const useCase = new UpdateRestaurantUseCase(repo);
    await expect(useCase.execute('tenant-a', { slug: 'paused-slug' }, 'super_admin')).rejects.toThrow(ConflictError);
    expect((await repo.findById('tenant-a'))?.slug).toBe('tenant-a');
  });

  it('update to its own current slug is still a no-op, not a conflict', async () => {
    const repo = await withPausedTenant();
    const useCase = new UpdateRestaurantUseCase(repo);
    await expect(useCase.execute('paused-one', { slug: 'paused-slug' }, 'super_admin')).resolves.toBeDefined();
  });
});

describe('restaurant name and category hygiene', () => {
  it('create rejects a whitespace-only name', async () => {
    const useCase = new CreateRestaurantUseCase(new InMemoryRestaurantRepository());
    await expect(useCase.execute({ name: '   ', slug: 'blanco' })).rejects.toThrow(ValidationError);
  });

  it('update rejects a whitespace-only name and keeps the stored one', async () => {
    const repo = new InMemoryRestaurantRepository();
    const before = (await repo.findById('tenant-a'))!.name;
    const useCase = new UpdateRestaurantUseCase(repo);
    await expect(useCase.execute('tenant-a', { name: '   ' }, 'super_admin')).rejects.toThrow(ValidationError);
    expect((await repo.findById('tenant-a'))?.name).toBe(before);
  });

  it('create trims category names', async () => {
    const repo = new InMemoryRestaurantRepository();
    const created = await new CreateRestaurantUseCase(repo).execute({
      name: 'Con categorias',
      slug: 'con-categorias',
      categories: ['  Postres ', 'postres', '   '],
    });
    expect(created.categories).toEqual(['Postres']);
  });
});
