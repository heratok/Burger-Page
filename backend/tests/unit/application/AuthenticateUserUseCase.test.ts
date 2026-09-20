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
    username: 'admin_rosto',
    passwordHash: 'hashed_password',
    role: 'restaurant_admin',
    restaurantId: 'rosto',
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

    const result = await useCase.execute('admin_rosto', 'securePass123');

    expect(result.success).toBe(true);
    expect(result.user).toMatchObject({
      id: 'u1',
      username: 'admin_rosto',
      role: 'restaurant_admin',
      restaurantId: 'rosto',
    });
    expect((result.user as any).passwordHash).toBeUndefined();
    expect(userRepo.findByUsername).toHaveBeenCalledWith('admin_rosto');
    expect(hasher.verify).toHaveBeenCalledWith('securePass123', 'hashed_password');
  });

  it('falls back to the admin_ prefix lookup when the raw username has no match', async () => {
    vi.mocked(userRepo.findByUsername).mockImplementation(async (u) =>
      u === 'admin_rosto' ? storedUser : null
    );
    const useCase = new AuthenticateUserUseCase(userRepo, hasher);

    const result = await useCase.execute('rosto', 'securePass123');

    expect(result.success).toBe(true);
    expect(result.user?.username).toBe('admin_rosto');
    expect(userRepo.findByUsername).toHaveBeenNthCalledWith(1, 'rosto');
    expect(userRepo.findByUsername).toHaveBeenNthCalledWith(2, 'admin_rosto');
  });

  it('falls back to the restaurant-identifier lookup for rest- prefixed logins', async () => {
    vi.mocked(userRepo.findByUsername).mockResolvedValue(null);
    vi.mocked(userRepo.findByRestaurantId).mockImplementation(async (id) =>
      id === 'rosto' ? [storedUser] : []
    );
    const useCase = new AuthenticateUserUseCase(userRepo, hasher);

    const result = await useCase.execute('rosto', 'securePass123');

    expect(result.success).toBe(true);
    expect(result.user?.restaurantId).toBe('rosto');
    expect(userRepo.findByRestaurantId).toHaveBeenCalledWith('rosto');
  });

  it('rejects an inactive account without reaching the password check', async () => {
    vi.mocked(userRepo.findByUsername).mockResolvedValue({ ...storedUser, isActive: false });
    const useCase = new AuthenticateUserUseCase(userRepo, hasher);

    await expect(useCase.execute('admin_rosto', 'securePass123')).rejects.toThrow(UnauthorizedError);
    expect(hasher.verify).not.toHaveBeenCalled();
  });

  it('rejects a wrong password', async () => {
    vi.mocked(hasher.verify).mockResolvedValue(false);
    const useCase = new AuthenticateUserUseCase(userRepo, hasher);

    await expect(useCase.execute('admin_rosto', 'wrongPassword')).rejects.toThrow(UnauthorizedError);
  });

  it('rejects an unknown credential after trying every lookup fallback', async () => {
    vi.mocked(userRepo.findByUsername).mockResolvedValue(null);
    const useCase = new AuthenticateUserUseCase(userRepo, hasher);

    await expect(useCase.execute('ghost_user', 'anyPassword')).rejects.toThrow(UnauthorizedError);
    // The rest- identifier fallback is attempted but finds no restaurant admin.
    expect(userRepo.findByRestaurantId).toHaveBeenCalled();
  });
});