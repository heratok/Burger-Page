import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_ROLE_TEMPLATES } from '@burger-page/contracts';
import { CreateRestaurantUseCase } from '../../src/application/use-cases/CreateRestaurantUseCase.js';
import { InMemoryRoleRepository } from '../../src/infrastructure/persistence/InMemoryRoleRepository.js';
import { RestaurantRepository } from '../../src/domain/ports/out/RestaurantRepository.js';
import { UserRepository } from '../../src/domain/ports/out/UserRepository.js';
import { PasswordHasher } from '../../src/domain/ports/out/PasswordHasher.js';

describe('CreateRestaurantUseCase default staff roles', () => {
  let restaurantRepo: RestaurantRepository;
  let roleRepo: InMemoryRoleRepository;

  beforeEach(() => {
    restaurantRepo = {
      findById: vi.fn().mockResolvedValue(null),
      findBySlug: vi.fn().mockResolvedValue(null),
      slugExists: vi.fn().mockResolvedValue(false),
      findAll: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(true),
      hardDelete: vi.fn().mockResolvedValue(true),
    } as any;
    roleRepo = new InMemoryRoleRepository();
  });

  const build = (extra: { userRepo?: UserRepository; hasher?: PasswordHasher } = {}) =>
    new CreateRestaurantUseCase(
      restaurantRepo,
      undefined,
      extra.userRepo,
      extra.hasher,
      undefined,
      undefined,
      undefined,
      roleRepo
    );

  it('seeds exactly the default templates as editable, non-system roles', async () => {
    const created = await build().execute({ name: 'Burger Test', slug: 'burger-test' } as any);

    const roles = await roleRepo.findByRestaurantId(created.id);
    expect(roles).toHaveLength(DEFAULT_ROLE_TEMPLATES.length);
    expect(roles.map((r) => r.name).sort()).toEqual(DEFAULT_ROLE_TEMPLATES.map((t) => t.name).sort());
    for (const role of roles) {
      const template = DEFAULT_ROLE_TEMPLATES.find((t) => t.name === role.name)!;
      expect(role.isSystem).toBe(false);
      expect(role.restaurantId).toBe(created.id);
      expect(role.id).toMatch(/^role_/);
      expect(role.description).toBe(template.description);
      expect(role.permissions).toEqual(template.permissions);
      expect(role.createdAt).toBeTruthy();
      expect(role.updatedAt).toBe(role.createdAt);
    }
    const cashier = roles.find((r) => r.name === 'Cajero')!;
    expect(cashier.permissions).not.toContain('finance.view');
  });

  it('does not seed roles into another restaurant', async () => {
    const a = await build().execute({ name: 'A', slug: 'a-shop' } as any);
    const b = await build().execute({ name: 'B', slug: 'b-shop' } as any);

    expect(await roleRepo.findByRestaurantId(a.id)).toHaveLength(DEFAULT_ROLE_TEMPLATES.length);
    expect(await roleRepo.findByRestaurantId(b.id)).toHaveLength(DEFAULT_ROLE_TEMPLATES.length);
  });

  it('rolls the tenant back and rethrows when a role cannot be saved', async () => {
    const boom = new Error('roles down');
    const realSave = roleRepo.save.bind(roleRepo);
    let calls = 0;
    vi.spyOn(roleRepo, 'save').mockImplementation(async (role) => {
      calls++;
      if (calls === 3) throw boom;
      return realSave(role);
    });

    await expect(build().execute({ name: 'Burger Test', slug: 'burger-test' } as any)).rejects.toBe(boom);

    const savedId = (restaurantRepo.save as any).mock.calls[0][0].id;
    expect(restaurantRepo.hardDelete).toHaveBeenCalledWith(savedId);
    // Adapters without foreign keys must not leak the roles saved before the failure.
    expect(await roleRepo.findByRestaurantId(savedId)).toEqual([]);
  });

  it('removes the seeded roles too when the admin user cannot be provisioned', async () => {
    const userRepo = {
      findByUsername: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockRejectedValue(new Error('users down')),
    } as any;
    const hasher = { hash: vi.fn().mockResolvedValue('hash') } as any;

    await expect(
      build({ userRepo, hasher }).execute({ name: 'Burger Test', slug: 'burger-test' } as any)
    ).rejects.toThrow('users down');

    const savedId = (restaurantRepo.save as any).mock.calls[0][0].id;
    expect(restaurantRepo.hardDelete).toHaveBeenCalledWith(savedId);
    expect(await roleRepo.findByRestaurantId(savedId)).toEqual([]);
  });

  it('behaves as before when no roleRepo is wired', async () => {
    const useCase = new CreateRestaurantUseCase(restaurantRepo);
    const created = await useCase.execute({ name: 'Burger Test', slug: 'burger-test' } as any);

    expect(created.slug).toBe('burger-test');
    expect(await roleRepo.findByRestaurantId(created.id)).toEqual([]);
  });
});
