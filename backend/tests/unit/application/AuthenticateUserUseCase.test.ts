import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthenticateUserUseCase } from '../../../src/application/use-cases/AuthenticateUserUseCase.js';
import { UserRepository } from '../../../src/domain/ports/out/UserRepository.js';
import { PasswordHasher } from '../../../src/domain/ports/out/PasswordHasher.js';
import { UnauthorizedError } from '../../../src/domain/errors/DomainErrors.js';
import type { User } from '../../../src/domain/models/User.js';

// Regression pin for the login path (JD-CRIT-03 seam 2): the use case must
// keep resolving the single matching user through the repository's
// findByUsername/findByRestaurantId port calls — the repository implements
// them via the narrow SECURITY DEFINER escape hatch, never a no-context
// full-table read. This file pins the use-case behavior itself with a fake
// repository (no Postgres involved).
describe('AuthenticateUserUseCase (login bootstrap contract)', () => {
  const storedUser: User = {
    id: 'u1',
    username: 'admin_pruebas',
    passwordHash: 'hashed_password',
    role: 'restaurant_admin',
    restaurantId: 'tienda-pruebas',
    createdAt: new Date().toISOString(),
    isActive: true,
  };

  let userRepo: UserRepository;
  let hasher: PasswordHasher;

  beforeEach(() => {
    userRepo = {
      findById: vi.fn(),
      findByUsername: vi.fn().mockResolvedValue(storedUser),
      findByRestaurantId: vi.fn().mockResolvedValue([]),
      findAll: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };
    hasher = { hash: vi.fn(), verify: vi.fn().mockResolvedValue(true) };
  });

  it('authenticates the single matching username and never returns passwordHash', async () => {
    const useCase = new AuthenticateUserUseCase(userRepo, hasher);

    const result = await useCase.execute('admin_pruebas', 'securePass123');

    expect(result.success).toBe(true);
    expect(result.user).toMatchObject({
      id: 'u1',
      username: 'admin_pruebas',
      role: 'restaurant_admin',
      restaurantId: 'tienda-pruebas',
    });
    expect((result.user as any).passwordHash).toBeUndefined();
    expect(userRepo.findByUsername).toHaveBeenCalledWith('admin_pruebas');
    expect(hasher.verify).toHaveBeenCalledWith('securePass123', 'hashed_password');
  });

  it('falls back to the admin_ prefix lookup when the raw username has no match', async () => {
    vi.mocked(userRepo.findByUsername).mockImplementation(async (u) =>
      u === 'admin_pruebas' ? storedUser : null
    );
    const useCase = new AuthenticateUserUseCase(userRepo, hasher);

    const result = await useCase.execute('pruebas', 'securePass123');

    expect(result.success).toBe(true);
    expect(result.user?.username).toBe('admin_pruebas');
    expect(userRepo.findByUsername).toHaveBeenNthCalledWith(1, 'pruebas');
    expect(userRepo.findByUsername).toHaveBeenNthCalledWith(2, 'admin_pruebas');
  });

  it('falls back to the restaurant-identifier lookup for rest- prefixed logins', async () => {
    vi.mocked(userRepo.findByUsername).mockResolvedValue(null);
    vi.mocked(userRepo.findByRestaurantId).mockImplementation(async (id) =>
      id === 'tienda-pruebas' ? [storedUser] : []
    );
    const useCase = new AuthenticateUserUseCase(userRepo, hasher);

    const result = await useCase.execute('tienda-pruebas', 'securePass123');

    expect(result.success).toBe(true);
    expect(result.user?.restaurantId).toBe('tienda-pruebas');
    expect(userRepo.findByRestaurantId).toHaveBeenCalledWith('tienda-pruebas');
  });

  it('rejects an inactive account without reaching the password check', async () => {
    vi.mocked(userRepo.findByUsername).mockResolvedValue({ ...storedUser, isActive: false });
    const useCase = new AuthenticateUserUseCase(userRepo, hasher);

    await expect(useCase.execute('admin_pruebas', 'securePass123')).rejects.toThrow(UnauthorizedError);
    expect(hasher.verify).not.toHaveBeenCalled();
  });

  it('rejects a wrong password', async () => {
    vi.mocked(hasher.verify).mockResolvedValue(false);
    const useCase = new AuthenticateUserUseCase(userRepo, hasher);

    await expect(useCase.execute('admin_pruebas', 'wrongPassword')).rejects.toThrow(UnauthorizedError);
  });

  it('rejects an unknown credential after trying every lookup fallback', async () => {
    vi.mocked(userRepo.findByUsername).mockResolvedValue(null);
    const useCase = new AuthenticateUserUseCase(userRepo, hasher);

    await expect(useCase.execute('ghost_user', 'anyPassword')).rejects.toThrow(UnauthorizedError);
    // The rest- identifier fallback is attempted but finds no restaurant admin.
    expect(userRepo.findByRestaurantId).toHaveBeenCalled();
  });

  describe('tenant lifecycle', () => {
    const restaurantRepoWith = (restaurant: { id: string; isActive: boolean } | null) =>
      ({
        findById: vi.fn().mockResolvedValue(restaurant),
        findBySlug: vi.fn().mockResolvedValue(restaurant),
        findAll: vi.fn(),
        save: vi.fn(),
        delete: vi.fn(),
      }) as any;

    it('rejects an admin of an inactive restaurant with the generic credentials error', async () => {
      const useCase = new AuthenticateUserUseCase(
        userRepo,
        hasher,
        undefined,
        restaurantRepoWith({ id: 'tienda-pruebas', isActive: false })
      );

      await expect(useCase.execute('admin_pruebas', 'securePass123')).rejects.toThrow('Invalid credentials');
    });

    it('rejects an admin of a deleted (unresolvable) restaurant', async () => {
      const useCase = new AuthenticateUserUseCase(userRepo, hasher, undefined, restaurantRepoWith(null));

      await expect(useCase.execute('admin_pruebas', 'securePass123')).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('lets an admin of an active restaurant in, and never checks users without a tenant', async () => {
      const active = restaurantRepoWith({ id: 'tienda-pruebas', isActive: true });
      const ok = await new AuthenticateUserUseCase(userRepo, hasher, undefined, active).execute(
        'admin_pruebas',
        'securePass123'
      );
      expect(ok.success).toBe(true);

      vi.mocked(userRepo.findByUsername).mockResolvedValue({ ...storedUser, role: 'super_admin', restaurantId: undefined });
      const none = restaurantRepoWith(null);
      const sa = await new AuthenticateUserUseCase(userRepo, hasher, undefined, none).execute('root', 'securePass123');
      expect(sa.success).toBe(true);
      expect(none.findById).not.toHaveBeenCalled();
    });
  });
});
