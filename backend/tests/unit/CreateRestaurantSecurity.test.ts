import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateRestaurantUseCase } from '../../src/application/use-cases/CreateRestaurantUseCase.js';
import { RestaurantRepository } from '../../src/domain/ports/out/RestaurantRepository.js';
import { CategoryRepository } from '../../src/domain/ports/out/CategoryRepository.js';
import { ConflictError } from '../../src/domain/errors/DomainErrors.js';
import { buildApp } from '../../src/infrastructure/http/app.js';

// RED unit 5: restaurant ids and admin passwords must be server-owned.
describe('CreateRestaurantUseCase (Security Hardening)', () => {
  let mockRestaurantRepo: RestaurantRepository;
  let mockCategoryRepo: CategoryRepository;
  let useCase: CreateRestaurantUseCase;

  beforeEach(() => {
    mockRestaurantRepo = {
      findById: vi.fn().mockResolvedValue(null),
      findBySlug: vi.fn().mockResolvedValue(null),
      findAll: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(true),
    } as any;
    mockCategoryRepo = {
      save: vi.fn().mockResolvedValue(undefined),
    } as any;
    useCase = new CreateRestaurantUseCase(mockRestaurantRepo, mockCategoryRepo);
  });

  it('ignores client-supplied id and generates a server-side one', async () => {
    const result = await useCase.execute({
      name: 'Burger Test',
      slug: 'burger-test',
      id: 'rest-existing-tenant',
    } as any);

    expect(result.id).not.toBe('rest-existing-tenant');
    expect(result.id).toMatch(/^rest_/);
    expect((mockRestaurantRepo.save as any).mock.calls[0][0].id).toBe(result.id);
  });

  it('creates a restaurant with zero categories when none are provided (no fabricated default)', async () => {
    const result = await useCase.execute({ name: 'Burger Test', slug: 'burger-test' } as any);

    // No layer fabricates a "General" category: the owner creates categories.
    expect(result.categories).toEqual([]);
    expect((mockRestaurantRepo.save as any).mock.calls[0][0].categories).toEqual([]);
    // Nothing to persist as a Category row either.
    expect(mockCategoryRepo.save).not.toHaveBeenCalled();
  });

  it('preserves explicitly provided categories instead of replacing them', async () => {
    const result = await useCase.execute({
      name: 'Burger Test',
      slug: 'burger-test',
      categories: ['Pizza', 'Bebidas'],
    } as any);

    expect(result.categories).toEqual(['Pizza', 'Bebidas']);
    expect(mockCategoryRepo.save).toHaveBeenCalledTimes(2);
  });

  it('generates a random admin password instead of the public default', async () => {
    const result = await useCase.execute({ name: 'Burger Test', slug: 'burger-test' } as any);

    expect(result.adminPassword).toBeDefined();
    expect(result.adminPassword).not.toBe('admin123');
    expect(result.adminPassword!.length).toBeGreaterThanOrEqual(12);
  });

  it('keeps an explicit admin password only when the caller provides one', async () => {
    const result = await useCase.execute({
      name: 'Burger Test',
      slug: 'burger-test',
      adminPassword: 'custom-secret-42',
    } as any);

    expect(result.adminPassword).toBe('custom-secret-42');
  });

  it('provisions the admin user row when userRepo and hasher are injected (SUS-02)', async () => {
    const mockUserRepo = {
      findByUsername: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
    } as any;
    const mockHasher = {
      hash: vi.fn(async (p: string) => `hashed:${p}`),
      verify: vi.fn(),
    } as any;
    const useCaseWithUsers = new CreateRestaurantUseCase(
      mockRestaurantRepo,
      mockCategoryRepo,
      mockUserRepo,
      mockHasher
    );

    const result = await useCaseWithUsers.execute({
      name: 'Burger Test',
      slug: 'burger-test',
      adminPassword: 'custom-secret-42',
    } as any);

    expect(mockUserRepo.save).toHaveBeenCalledTimes(1);
    const [savedUser, actorRole] = mockUserRepo.save.mock.calls[0];
    expect(savedUser.username).toBe('admin_burger-test');
    expect(savedUser.role).toBe('restaurant_admin');
    expect(savedUser.mustChangePassword).toBe(true);
    expect(savedUser.restaurantId).toBe(result.id);
    expect(savedUser.isActive).toBe(true);
    expect(savedUser.createdAt).toBeDefined();
    // The stored credential is the hash of the returned one-time password
    expect(mockHasher.hash).toHaveBeenCalledWith('custom-secret-42');
    expect(savedUser.passwordHash).toBe('hashed:custom-secret-42');
    // SUS-03: the real caller role is forwarded to the user repository
    expect(actorRole).toBe('super_admin');
    // The entity still carries the one-time credentials for the caller
    expect(result.adminPassword).toBe('custom-secret-42');
    expect((result as any).adminUsername).toBe('admin_burger-test');
  });

  it('uses a caller-provided adminUsername and forwards an explicit caller role (SUS-02/SUS-03)', async () => {
    const mockUserRepo = {
      findByUsername: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
    } as any;
    const mockHasher = {
      hash: vi.fn(async (p: string) => `hashed:${p}`),
      verify: vi.fn(),
    } as any;
    const useCaseWithUsers = new CreateRestaurantUseCase(
      mockRestaurantRepo,
      mockCategoryRepo,
      mockUserRepo,
      mockHasher
    );

    const result = await useCaseWithUsers.execute(
      {
        name: 'Burger Test',
        slug: 'burger-test',
        adminUsername: '  gerente  ',
      } as any,
      'restaurant_admin'
    );

    expect(mockUserRepo.save).toHaveBeenCalledTimes(1);
    const [savedUser, actorRole] = mockUserRepo.save.mock.calls[0];
    expect(savedUser.username).toBe('gerente');
    expect(savedUser.passwordHash).toBeDefined();
    expect(savedUser.restaurantId).toBe(result.id);
    expect(actorRole).toBe('restaurant_admin');
    expect((result as any).adminUsername).toBe('gerente');
  });

  it('keeps creating the tenant when userRepo is not injected (backward-compatible)', async () => {
    const result = await useCase.execute({ name: 'Burger Test', slug: 'burger-test' } as any);

    expect(result.id).toMatch(/^rest_/);
    expect(result.adminPassword).toBeDefined();
  });

  it('rolls the tenant back and surfaces the error when the admin user save fails', async () => {
    const mockUserRepo = {
      findByUsername: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockRejectedValue(new Error('user save failed')),
    } as any;
    const mockHasher = {
      hash: vi.fn(async (p: string) => `hashed:${p}`),
      verify: vi.fn(),
    } as any;
    (mockRestaurantRepo as any).hardDelete = vi.fn().mockResolvedValue(undefined);
    const useCaseWithUsers = new CreateRestaurantUseCase(
      mockRestaurantRepo,
      mockCategoryRepo,
      mockUserRepo,
      mockHasher
    );

    await expect(
      useCaseWithUsers.execute({ name: 'Burger Test', slug: 'burger-test' } as any)
    ).rejects.toThrow('user save failed');

    const savedId = (mockRestaurantRepo.save as any).mock.calls[0][0].id;
    expect((mockRestaurantRepo as any).hardDelete).toHaveBeenCalledWith(savedId);
  });

  it('never persists the plaintext adminPassword on the restaurant record', async () => {
    const mockUserRepo = {
      findByUsername: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
    } as any;
    const mockHasher = {
      hash: vi.fn(async (p: string) => `hashed:${p}`),
      verify: vi.fn(),
    } as any;
    const useCaseWithUsers = new CreateRestaurantUseCase(
      mockRestaurantRepo,
      mockCategoryRepo,
      mockUserRepo,
      mockHasher
    );

    const result = await useCaseWithUsers.execute({
      name: 'Burger Test',
      slug: 'burger-test',
      adminPassword: 'custom-secret-42',
    } as any);

    expect((mockRestaurantRepo.save as any).mock.calls[0][0]).not.toHaveProperty('adminPassword');
    expect(result.adminPassword).toBe('custom-secret-42');
  });

  it('rejects a too-short adminPassword before creating anything', async () => {
    await expect(
      useCase.execute({ name: 'Burger Test', slug: 'burger-test', adminPassword: 'short' } as any)
    ).rejects.toThrow(/at least 8/);
    expect(mockRestaurantRepo.save).not.toHaveBeenCalled();
  });

  it('rejects a colliding adminUsername with a ConflictError before creating the tenant (JD-B-001)', async () => {
    // The seeded super admin 'admin' already owns the username: neither the
    // restaurant nor the user may be saved, so no password_hash/role/
    // restaurant_id rewrite can happen through the Pg username-or-id upsert.
    const mockUserRepo = {
      findByUsername: vi.fn().mockResolvedValue({ id: 'usr-seeded-admin', username: 'admin', role: 'super_admin' }),
      save: vi.fn().mockResolvedValue(undefined),
    } as any;
    const mockHasher = {
      hash: vi.fn(async (p: string) => `hashed:${p}`),
      verify: vi.fn(),
    } as any;
    const useCaseWithUsers = new CreateRestaurantUseCase(
      mockRestaurantRepo,
      mockCategoryRepo,
      mockUserRepo,
      mockHasher
    );

    await expect(
      useCaseWithUsers.execute({
        name: 'Burger Test',
        slug: 'burger-test',
        adminUsername: 'admin',
        adminPassword: 'custom-secret-42',
      } as any)
    ).rejects.toThrow(ConflictError);

    expect(mockUserRepo.findByUsername).toHaveBeenCalledWith('admin');
    expect(mockUserRepo.save).not.toHaveBeenCalled();
    expect(mockRestaurantRepo.save).not.toHaveBeenCalled();
  });
});
