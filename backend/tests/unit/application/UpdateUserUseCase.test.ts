import { describe, it, expect, beforeEach } from 'vitest';
import { UpdateUserUseCase } from '../../../src/application/use-cases/UpdateUserUseCase.js';
import { InMemoryUserRepository } from '../../../src/infrastructure/persistence/InMemoryUserRepository.js';
import { InMemoryRestaurantRepository } from '../../../src/infrastructure/persistence/InMemoryRestaurantRepository.js';
import { ConflictError, EntityNotFoundError, ValidationError } from '../../../src/domain/errors/DomainErrors.js';
import { User } from '../../../src/domain/models/User.js';

const user = (over: Partial<User>): User => ({
  id: 'u',
  username: 'u',
  passwordHash: 'hash',
  role: 'restaurant_admin',
  restaurantId: 'burger-craft',
  createdAt: '2026-01-01T00:00:00.000Z',
  isActive: true,
  ...over,
});

describe('UpdateUserUseCase', () => {
  let users: InMemoryUserRepository;
  let restaurants: InMemoryRestaurantRepository;
  let useCase: UpdateUserUseCase;

  beforeEach(async () => {
    users = new InMemoryUserRepository();
    for (const u of await users.findAll()) await users.delete(u.id);
    restaurants = new InMemoryRestaurantRepository();
    useCase = new UpdateUserUseCase(users, restaurants);
    await users.save(user({ id: 'root', username: 'root', role: 'super_admin', restaurantId: undefined }));
    await users.save(user({ id: 'root2', username: 'root2', role: 'super_admin', restaurantId: undefined }));
    await users.save(user({ id: 'tenant', username: 'tenant_admin' }));
  });

  it('renames a user (trimmed) and keeps the hash and other fields', async () => {
    const out = await useCase.execute({ actorId: 'root', targetId: 'tenant', username: '  new_name ' });
    expect(out.username).toBe('new_name');
    expect((await users.findById('tenant'))?.passwordHash).toBe('hash');
  });

  it('rejects an empty username with ValidationError', async () => {
    await expect(useCase.execute({ actorId: 'root', targetId: 'tenant', username: '   ' })).rejects.toThrow(ValidationError);
  });

  it('rejects a username owned by another user with ConflictError, but allows keeping its own', async () => {
    await expect(useCase.execute({ actorId: 'root', targetId: 'tenant', username: 'root2' })).rejects.toThrow(ConflictError);
    const same = await useCase.execute({ actorId: 'root', targetId: 'tenant', username: 'tenant_admin' });
    expect(same.username).toBe('tenant_admin');
  });

  it('404s on an unknown user and 400s when nothing is sent', async () => {
    await expect(useCase.execute({ actorId: 'root', targetId: 'nope', isActive: true })).rejects.toThrow(EntityNotFoundError);
    await expect(useCase.execute({ actorId: 'root', targetId: 'tenant' })).rejects.toThrow(ValidationError);
  });

  it('moves a restaurant admin to another existing restaurant and refuses a missing one', async () => {
    const moved = await useCase.execute({ actorId: 'root', targetId: 'tenant', restaurantId: 'tenant-a' });
    expect(moved.restaurantId).toBe('tenant-a');
    await expect(useCase.execute({ actorId: 'root', targetId: 'tenant', restaurantId: 'ghost' })).rejects.toThrow(EntityNotFoundError);
  });

  it('refuses to move an admin into a deleted restaurant', async () => {
    await restaurants.delete('tenant-b');
    await expect(useCase.execute({ actorId: 'root', targetId: 'tenant', restaurantId: 'tenant-b' })).rejects.toThrow(EntityNotFoundError);
  });

  it('promoting to super_admin clears the restaurant; a super_admin must not carry one', async () => {
    const promoted = await useCase.execute({ actorId: 'root', targetId: 'tenant', role: 'super_admin' });
    expect(promoted.role).toBe('super_admin');
    expect(promoted.restaurantId).toBeUndefined();
    await expect(
      useCase.execute({ actorId: 'root', targetId: 'root2', restaurantId: 'burger-craft' })
    ).rejects.toThrow(ValidationError);
  });

  it('demoting to restaurant_admin requires an existing restaurant', async () => {
    await expect(useCase.execute({ actorId: 'root', targetId: 'root2', role: 'restaurant_admin' })).rejects.toThrow(ValidationError);
    const demoted = await useCase.execute({ actorId: 'root', targetId: 'root2', role: 'restaurant_admin', restaurantId: 'burger-craft' });
    expect(demoted.role).toBe('restaurant_admin');
    expect(demoted.restaurantId).toBe('burger-craft');
  });

  it('a super admin cannot demote itself (409)', async () => {
    await expect(
      useCase.execute({ actorId: 'root', targetId: 'root', role: 'restaurant_admin', restaurantId: 'burger-craft' })
    ).rejects.toThrow(ConflictError);
    expect((await users.findById('root'))?.role).toBe('super_admin');
  });

  it('never demotes the last active super admin (409), but may once another one is active', async () => {
    await users.setActive('root2', false);
    await expect(
      useCase.execute({ actorId: 'someone-else', targetId: 'root', role: 'restaurant_admin', restaurantId: 'burger-craft' })
    ).rejects.toThrow(/last active super admin/);
    expect((await users.findById('root'))?.role).toBe('super_admin');

    await users.setActive('root2', true);
    const out = await useCase.execute({ actorId: 'root2', targetId: 'root', role: 'restaurant_admin', restaurantId: 'burger-craft' });
    expect(out.role).toBe('restaurant_admin');
  });

  it('still honours isActive in the same call, with the self-deactivation guard', async () => {
    const off = await useCase.execute({ actorId: 'root', targetId: 'tenant', isActive: false });
    expect(off.isActive).toBe(false);
    await expect(useCase.execute({ actorId: 'root', targetId: 'root', isActive: false })).rejects.toThrow(ConflictError);
  });
});
