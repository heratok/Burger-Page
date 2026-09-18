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