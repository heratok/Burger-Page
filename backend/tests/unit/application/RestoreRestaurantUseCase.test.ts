import { describe, it, expect, beforeEach } from 'vitest';
import { RestoreRestaurantUseCase } from '../../../src/application/use-cases/RestoreRestaurantUseCase.js';
import { ListDeletedRestaurantsUseCase } from '../../../src/application/use-cases/ListDeletedRestaurantsUseCase.js';
import { DeleteRestaurantUseCase } from '../../../src/application/use-cases/DeleteRestaurantUseCase.js';
import { InMemoryUserRepository } from '../../../src/infrastructure/persistence/InMemoryUserRepository.js';
import { InMemoryRestaurantRepository } from '../../../src/infrastructure/persistence/InMemoryRestaurantRepository.js';
import { ConflictError, EntityNotFoundError, ValidationError } from '../../../src/domain/errors/DomainErrors.js';

describe('deleted restaurants: list and restore', () => {
  let users: InMemoryUserRepository;
  let restaurants: InMemoryRestaurantRepository;
  let restore: RestoreRestaurantUseCase;
  let list: ListDeletedRestaurantsUseCase;

  beforeEach(async () => {
    users = new InMemoryUserRepository();
    restaurants = new InMemoryRestaurantRepository();
    restore = new RestoreRestaurantUseCase(restaurants, users);
    list = new ListDeletedRestaurantsUseCase(restaurants);
    await new DeleteRestaurantUseCase(restaurants, users).execute('burger-craft');
  });

  it('lists deleted tenants with the ORIGINAL slug and the deletion time', async () => {
    const deleted = await list.execute();
    expect(deleted).toHaveLength(1);
    expect(deleted[0]).toMatchObject({ id: 'burger-craft', name: expect.any(String), slug: 'burger-craft' });
    expect(Date.parse(deleted[0].deletedAt)).not.toBeNaN();
    expect(await restaurants.findById('burger-craft')).toBeNull();
  });

  it('restores the tenant PAUSED with its original slug and reactivates its users with original usernames', async () => {
    const { restaurant, renamedUsers } = await restore.execute({ id: 'burger-craft' });
    expect(restaurant).toMatchObject({ id: 'burger-craft', slug: 'burger-craft', isActive: false });
    expect(renamedUsers).toEqual([]);
    expect((await restaurants.findBySlug('burger-craft'))?.id).toBe('burger-craft');
    expect(await list.execute()).toEqual([]);
    const admin = await users.findById('user-admin-craft');
    expect(admin).toMatchObject({ username: 'admin_craft', isActive: true });
  });

  it('answers 404 for a tenant that is not deleted or unknown', async () => {
    await expect(restore.execute({ id: 'tenant-a' })).rejects.toThrow(EntityNotFoundError);
    await expect(restore.execute({ id: 'ghost' })).rejects.toThrow(EntityNotFoundError);
  });

  it('answers 409 when the original slug was reused, and nothing is restored', async () => {
    await restaurants.save({ ...(await restaurants.findById('tenant-a'))!, id: 'newcomer', slug: 'burger-craft' });
    await expect(restore.execute({ id: 'burger-craft' })).rejects.toThrow(ConflictError);
    expect(await list.execute()).toHaveLength(1);
    expect((await users.findById('user-admin-craft'))?.isActive).toBe(false);
  });

  it('restores under a chosen new slug (normalized), 409 if that one is taken, 400 if invalid', async () => {
    await restaurants.save({ ...(await restaurants.findById('tenant-a'))!, id: 'newcomer', slug: 'burger-craft' });
    await expect(restore.execute({ id: 'burger-craft', slug: 'tenant-b' })).rejects.toThrow(ConflictError);
    await expect(restore.execute({ id: 'burger-craft', slug: '---' })).rejects.toThrow(ValidationError);
    const { restaurant } = await restore.execute({ id: 'burger-craft', slug: 'Burger Craft Viejo' });
    expect(restaurant.slug).toBe('burger-craft-viejo');
  });

  it('keeps going when a retired username was taken meanwhile: the user gets a unique restored username', async () => {
    await users.save({ id: 'squatter', username: 'admin_craft', passwordHash: 'h', role: 'restaurant_admin', restaurantId: 'tenant-a', createdAt: '' });
    const { renamedUsers } = await restore.execute({ id: 'burger-craft' });
    expect(renamedUsers).toEqual([
      { id: 'user-admin-craft', from: 'admin_craft', to: 'admin_craft-restored-burger-craft' },
    ]);
    expect((await users.findById('user-admin-craft'))).toMatchObject({ username: 'admin_craft-restored-burger-craft', isActive: true });
    expect((await users.findById('squatter'))?.username).toBe('admin_craft');
  });
});
