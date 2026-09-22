import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateRestaurantUseCase } from '../../src/application/use-cases/CreateRestaurantUseCase.js';
import { RestaurantRepository } from '../../src/domain/ports/out/RestaurantRepository.js';
import { CategoryRepository } from '../../src/domain/ports/out/CategoryRepository.js';
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
      name: 'Rosto',
      slug: 'rosto',
      id: 'rest-existing-tenant',
    } as any);

    expect(result.id).not.toBe('rest-existing-tenant');
    expect(result.id).toMatch(/^rest-/);
    expect((mockRestaurantRepo.save as any).mock.calls[0][0].id).toBe(result.id);
  });

  it('generates a random admin password instead of the public default', async () => {
    const result = await useCase.execute({ name: 'Rosto', slug: 'rosto' } as any);

    expect(result.adminPassword).toBeDefined();
    expect(result.adminPassword).not.toBe('admin123');
    expect(result.adminPassword!.length).toBeGreaterThanOrEqual(12);
  });

  it('keeps an explicit admin password only when the caller provides one', async () => {
    const result = await useCase.execute({
      name: 'Rosto',
      slug: 'rosto',
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
      name: 'Rosto',
      slug: 'rosto',
      adminPassword: 'custom-secret-42',
    } as any);

    expect(mockUserRepo.save).toHaveBeenCalledTimes(1);
    const [savedUser, actorRole] = mockUserRepo.save.mock.calls[0];
    expect(savedUser.username).toBe('admin_rosto');
    expect(savedUser.role).toBe('restaurant_admin');
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
    expect((result as any).adminUsername).toBe('admin_rosto');
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
        name: 'Rosto',
        slug: 'rosto',
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
    const result = await useCase.execute({ name: 'Rosto', slug: 'rosto' } as any);

    expect(result.id).toMatch(/^rest-/);
    expect(result.adminPassword).toBeDefined();
  });

  it('keeps creating the tenant when the admin user save fails (secondary failure)', async () => {
    const mockUserRepo = {
      findByUsername: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockRejectedValue(new Error('user save failed')),
    } as any;
    const mockHasher = {
      hash: vi.fn(async (p: string) => `hashed:${p}`),
      verify: vi.fn(),
    } as any;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const useCaseWithUsers = new CreateRestaurantUseCase(
      mockRestaurantRepo,
      mockCategoryRepo,
      mockUserRepo,
      mockHasher
    );

    const result = await useCaseWithUsers.execute({ name: 'Rosto', slug: 'rosto' } as any);

    expect(result.id).toMatch(/^rest-/);
    expect(result.adminPassword).toBeDefined();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('never overwrites an existing user when adminUsername collides (JD-B-001)', async () => {
    // The seeded super admin 'admin' already owns the username: save() must
    // never be reached, so no password_hash/role/restaurant_id rewrite can
    // happen through the Pg username-or-id upsert.
    const mockUserRepo = {
      findByUsername: vi.fn().mockResolvedValue({
        id: 'usr-seeded-admin',
        username: 'admin',
        role: 'super_admin',
      }),
      save: vi.fn().mockResolvedValue(undefined),
    } as any;
    const mockHasher = {
      hash: vi.fn(async (p: string) => `hashed:${p}`),
      verify: vi.fn(),
    } as any;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const useCaseWithUsers = new CreateRestaurantUseCase(
      mockRestaurantRepo,
      mockCategoryRepo,
      mockUserRepo,
      mockHasher
    );

    const result = await useCaseWithUsers.execute({
      name: 'Rosto',
      slug: 'rosto',
      adminUsername: 'admin',
      adminPassword: 'custom-secret-42',
    } as any);

    // SUS-02 contract is preserved: the tenant is still created and the
    // response still carries the one-time credentials for a manual retry...
    expect(result.id).toMatch(/^rest-/);
    expect(result.adminPassword).toBe('custom-secret-42');
    // ...but the colliding user was never saved, and the secondary failure
    // reported through the existing warn path.
    expect(mockUserRepo.findByUsername).toHaveBeenCalledWith('admin');
    expect(mockUserRepo.save).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('Public restaurant API (Response Shape)', () => {
  it('does not expose adminPassword on GET /api/restaurants/:idOrSlug', async () => {
    const app = buildApp();
    await app.ready();
    // Seed a tenant through the authenticated super-admin path (in-memory driver
    // stores the raw entity, so the response schema is the only filter).
    const { JwtService } = await import('../../src/infrastructure/security/JwtService.js');
    const jwt = new JwtService();
    const token = jwt.generateToken({ id: 'usr-root', username: 'root', role: 'super_admin' });
    const created = await app.inject({
      method: 'POST',
      url: '/api/restaurants',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Rosto Test', slug: 'rosto-sec' },
    });
    expect(created.statusCode).toBe(201);
    const createdBody = created.json();
    expect(createdBody.id).toBeDefined();

    const res = await app.inject({ method: 'GET', url: `/api/restaurants/${createdBody.id}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).not.toHaveProperty('adminPassword');
    expect(body.id).toBe(createdBody.id);
    await app.close();
  });
});