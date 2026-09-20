import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateUserUseCase } from '../../src/application/use-cases/CreateUserUseCase.js';
import { AuthenticateUserUseCase } from '../../src/application/use-cases/AuthenticateUserUseCase.js';
import { ListUsersUseCase } from '../../src/application/use-cases/ListUsersUseCase.js';
import { UserRepository } from '../../src/domain/ports/out/UserRepository.js';
import { PasswordHasher } from '../../src/domain/ports/out/PasswordHasher.js';
import { RestaurantRepository } from '../../src/domain/ports/out/RestaurantRepository.js';
import { ValidationError, UnauthorizedError, EntityNotFoundError } from '../../src/domain/errors/DomainErrors.js';
import type { User } from '../../src/domain/models/User.js';
import { PgUserRepository } from '../../src/infrastructure/persistence/postgres/PgUserRepository.js';

// SUS-03 harness: capture every TenantContext passed to withTenantContext so
// the PgUserRepository assertions can verify app.actor_role is caller-derived
// (never hardcoded 'super_admin'). Same vi.mock pattern as PgOrderRepository.test.ts.
const pgCtx = vi.hoisted(() => ({ contexts: [] as Array<Record<string, unknown>> }));

vi.mock('../../src/infrastructure/persistence/postgres/PgClient.js', () => ({
  withTenantContext: async (ctx: Record<string, unknown>, cb: (c: unknown) => Promise<unknown>) => {
    pgCtx.contexts.push(ctx);
    return cb({ query: async () => ({ rows: [] }) });
  },
}));

describe('User Use Cases', () => {
  let mockUserRepo: UserRepository;
  let mockHasher: PasswordHasher;
  let mockRestaurantRepo: RestaurantRepository;

  beforeEach(() => {
    mockUserRepo = {
      findById: vi.fn(),
      findByUsername: vi.fn(),
      findByRestaurantId: vi.fn(),
      findAll: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };

    mockHasher = {
      hash: vi.fn().mockResolvedValue('hashed_password'),
      verify: vi.fn(),
    };

    mockRestaurantRepo = {
      findById: vi.fn().mockResolvedValue({ id: 'rosto', name: 'Rosto Burger', slug: 'rosto', isActive: true, config: {} }),
      findBySlug: vi.fn(),
      findAll: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };
  });

  // ─────────────────────────────────────────────────────────
  // CreateUserUseCase
  // ─────────────────────────────────────────────────────────
  describe('CreateUserUseCase', () => {
    it('should create a user with a hashed password', async () => {
      const useCase = new CreateUserUseCase(mockUserRepo, mockHasher, mockRestaurantRepo);
      vi.mocked(mockUserRepo.findByUsername).mockResolvedValue(null);

      const result = await useCase.execute({
        username: 'admin_rosto',
        password: 'securePass123',
        role: 'restaurant_admin',
        restaurantId: 'rosto',
      });

      expect(result.id).toBeDefined();
      expect(result.username).toBe('admin_rosto');
      expect(result.role).toBe('restaurant_admin');
      expect(result.restaurantId).toBe('rosto');
      expect(result.passwordHash).toBe('hashed_password');
      expect(mockHasher.hash).toHaveBeenCalledWith('securePass123');
      expect(mockUserRepo.save).toHaveBeenCalledWith(result, undefined);
    });

    it('should throw ValidationError when username is empty', async () => {
      const useCase = new CreateUserUseCase(mockUserRepo, mockHasher, mockRestaurantRepo);

      await expect(
        useCase.execute({
          username: '   ',
          password: 'securePass123',
          role: 'super_admin',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when password is shorter than 6 characters', async () => {
      const useCase = new CreateUserUseCase(mockUserRepo, mockHasher, mockRestaurantRepo);

      await expect(
        useCase.execute({
          username: 'admin',
          password: '123',
          role: 'super_admin',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when restaurant_admin has no restaurantId', async () => {
      const useCase = new CreateUserUseCase(mockUserRepo, mockHasher, mockRestaurantRepo);

      await expect(
        useCase.execute({
          username: 'admin_local',
          password: 'securePass123',
          role: 'restaurant_admin',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw EntityNotFoundError when restaurant_admin references a non-existent restaurant', async () => {
      const useCase = new CreateUserUseCase(mockUserRepo, mockHasher, mockRestaurantRepo);
      vi.mocked(mockRestaurantRepo.findById).mockResolvedValue(null);

      await expect(
        useCase.execute({
          username: 'admin_ghost',
          password: 'securePass123',
          role: 'restaurant_admin',
          restaurantId: 'non-existent-rest',
        })
      ).rejects.toThrow(EntityNotFoundError);
    });

    it('should throw EntityNotFoundError when restaurant_admin references an inactive restaurant', async () => {
      const useCase = new CreateUserUseCase(mockUserRepo, mockHasher, mockRestaurantRepo);
      vi.mocked(mockRestaurantRepo.findById).mockResolvedValue({
        id: 'inactive-rest',
        name: 'Inactive Restaurant',
        slug: 'inactive',
        isActive: false,
        config: {},
      });

      await expect(
        useCase.execute({
          username: 'admin_inactive',
          password: 'securePass123',
          role: 'restaurant_admin',
          restaurantId: 'inactive-rest',
        })
      ).rejects.toThrow(EntityNotFoundError);
    });

    it('should throw ValidationError when username already exists', async () => {
      const useCase = new CreateUserUseCase(mockUserRepo, mockHasher, mockRestaurantRepo);
      const existingUser: User = {
        id: 'u1',
        username: 'admin_rosto',
        passwordHash: 'hashed',
        role: 'restaurant_admin',
        restaurantId: 'rosto',
        createdAt: new Date().toISOString(),
      };
      vi.mocked(mockUserRepo.findByUsername).mockResolvedValue(existingUser);

      await expect(
        useCase.execute({
          username: 'admin_rosto',
          password: 'securePass123',
          role: 'restaurant_admin',
          restaurantId: 'rosto',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should forward the granted actor role to the repository save', async () => {
      const useCase = new CreateUserUseCase(mockUserRepo, mockHasher, mockRestaurantRepo);
      vi.mocked(mockUserRepo.findByUsername).mockResolvedValue(null);

      await useCase.execute(
        {
          username: 'admin_rosto',
          password: 'securePass123',
          role: 'restaurant_admin',
          restaurantId: 'rosto',
        },
        'super_admin'
      );

      expect(mockUserRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'admin_rosto', role: 'restaurant_admin' }),
        'super_admin'
      );
    });

    it('should allow super_admin creation without restaurantId', async () => {
      const useCase = new CreateUserUseCase(mockUserRepo, mockHasher, mockRestaurantRepo);
      vi.mocked(mockUserRepo.findByUsername).mockResolvedValue(null);

      const result = await useCase.execute({
        username: 'superadmin',
        password: 'securePass123',
        role: 'super_admin',
      });

      expect(result.role).toBe('super_admin');
      expect(result.restaurantId).toBeUndefined();
      expect(mockUserRepo.save).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────
  // AuthenticateUserUseCase
  // ─────────────────────────────────────────────────────────
  describe('AuthenticateUserUseCase', () => {
    const storedUser: User = {
      id: 'u1',
      username: 'admin_rosto',
      passwordHash: 'hashed_password',
      role: 'restaurant_admin',
      restaurantId: 'rosto',
      createdAt: new Date().toISOString(),
    };

    it('should authenticate with valid credentials and return user without passwordHash', async () => {
      const useCase = new AuthenticateUserUseCase(mockUserRepo, mockHasher);
      vi.mocked(mockUserRepo.findByUsername).mockResolvedValue(storedUser);
      vi.mocked(mockHasher.verify).mockResolvedValue(true);

      const result = await useCase.execute('admin_rosto', 'securePass123');

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user!.username).toBe('admin_rosto');
      expect(result.user!.role).toBe('restaurant_admin');
      expect(result.user!.restaurantId).toBe('rosto');
      expect((result.user as any).passwordHash).toBeUndefined();
      expect(mockHasher.verify).toHaveBeenCalledWith('securePass123', 'hashed_password');
    });

        it('should throw UnauthorizedError when the account is deactivated (isActive=false)', async () => {
          const useCase = new AuthenticateUserUseCase(mockUserRepo, mockHasher);
          vi.mocked(mockUserRepo.findByUsername).mockResolvedValue({ ...storedUser, isActive: false });
          vi.mocked(mockHasher.verify).mockResolvedValue(true);

          await expect(
            useCase.execute('admin_rosto', 'securePass123')
          ).rejects.toThrow(UnauthorizedError);
          // Deactivated users must not reach the password check path.
          expect(mockHasher.verify).not.toHaveBeenCalled();
        });

    it('should throw UnauthorizedError for non-existent username', async () => {
      const useCase = new AuthenticateUserUseCase(mockUserRepo, mockHasher);
      vi.mocked(mockUserRepo.findByUsername).mockResolvedValue(null);

      await expect(
        useCase.execute('ghost_user', 'anyPassword')
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError for wrong password', async () => {
      const useCase = new AuthenticateUserUseCase(mockUserRepo, mockHasher);
      vi.mocked(mockUserRepo.findByUsername).mockResolvedValue(storedUser);
      vi.mocked(mockHasher.verify).mockResolvedValue(false);

      await expect(
        useCase.execute('admin_rosto', 'wrongPassword')
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should authenticate with restaurant alias without admin_ prefix (e.g. rosto -> admin_rosto)', async () => {
      const useCase = new AuthenticateUserUseCase(mockUserRepo, mockHasher);
      vi.mocked(mockUserRepo.findByUsername).mockImplementation(async (u) => {
        if (u === 'admin_rosto') return storedUser;
        return null;
      });
      vi.mocked(mockHasher.verify).mockResolvedValue(true);

      const result = await useCase.execute('rosto', 'securePass123');

      expect(result.success).toBe(true);
      expect(result.user?.username).toBe('admin_rosto');
      expect(result.user?.restaurantId).toBe('rosto');
    });

    it('should authenticate with restaurantId fallback when username matches restaurantId', async () => {
      const useCase = new AuthenticateUserUseCase(mockUserRepo, mockHasher);
      vi.mocked(mockUserRepo.findByUsername).mockResolvedValue(null);
      vi.mocked(mockUserRepo.findByRestaurantId).mockResolvedValue([storedUser]);
      vi.mocked(mockHasher.verify).mockResolvedValue(true);

      const result = await useCase.execute('rosto', 'securePass123');

      expect(result.success).toBe(true);
      expect(result.user?.username).toBe('admin_rosto');
      expect(result.user?.restaurantId).toBe('rosto');
    });

    it('should authenticate with restaurantId fallback when username has rest- prefix (e.g. rest-rosto)', async () => {
      const useCase = new AuthenticateUserUseCase(mockUserRepo, mockHasher);
      vi.mocked(mockUserRepo.findByUsername).mockResolvedValue(null);
      vi.mocked(mockUserRepo.findByRestaurantId).mockImplementation(async (rId) => {
        if (rId === 'rosto') return [storedUser];
        return [];
      });
      vi.mocked(mockHasher.verify).mockResolvedValue(true);

      const result = await useCase.execute('rest-rosto', 'securePass123');

      expect(result.success).toBe(true);
      expect(result.user?.username).toBe('admin_rosto');
      expect(result.user?.restaurantId).toBe('rosto');
    });
  });

  // ─────────────────────────────────────────────────────────
  // ListUsersUseCase
  // ─────────────────────────────────────────────────────────
  describe('ListUsersUseCase', () => {
    const users: User[] = [
      {
        id: 'u1',
        username: 'super',
        passwordHash: 'h1',
        role: 'super_admin',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'u2',
        username: 'admin_rosto',
        passwordHash: 'h2',
        role: 'restaurant_admin',
        restaurantId: 'rosto',
        createdAt: new Date().toISOString(),
      },
    ];

    it('should list all users without passwordHash', async () => {
      const useCase = new ListUsersUseCase(mockUserRepo);
      vi.mocked(mockUserRepo.findAll).mockResolvedValue(users);

      const result = await useCase.execute();

      expect(result).toHaveLength(2);
      result.forEach((u) => {
        expect((u as any).passwordHash).toBeUndefined();
      });
    });

    it('should pass callerRole through to findAll when listing all users', async () => {
      const useCase = new ListUsersUseCase(mockUserRepo);
      vi.mocked(mockUserRepo.findAll).mockResolvedValue(users);

      await useCase.execute(undefined, 'super_admin');

      expect(mockUserRepo.findAll).toHaveBeenCalledWith('super_admin');
    });

    it('should omit callerRole when it is undefined', async () => {
      const useCase = new ListUsersUseCase(mockUserRepo);
      vi.mocked(mockUserRepo.findAll).mockResolvedValue(users);

      await useCase.execute();

      expect(mockUserRepo.findAll).toHaveBeenCalledWith(undefined);
    });

    it('should filter users by restaurantId', async () => {
      const useCase = new ListUsersUseCase(mockUserRepo);
      vi.mocked(mockUserRepo.findByRestaurantId).mockResolvedValue([users[1]]);

      const result = await useCase.execute('rosto');

      expect(result).toHaveLength(1);
      expect(result[0].username).toBe('admin_rosto');
      expect(mockUserRepo.findByRestaurantId).toHaveBeenCalledWith('rosto');
    });
  });

  // ─────────────────────────────────────────────────────────
  // PgUserRepository actor-role propagation (SUS-03)
  // ─────────────────────────────────────────────────────────
  describe('PgUserRepository actor-role propagation', () => {
    const user = (): User => ({
      id: 'u1',
      username: 'admin_rosto',
      passwordHash: 'hashed',
      role: 'restaurant_admin',
      restaurantId: 'rosto',
      createdAt: new Date().toISOString(),
    });

    beforeEach(() => {
      pgCtx.contexts.length = 0;
    });

    it('save with actorRole super_admin passes it into the tenant context', async () => {
      const repo = new PgUserRepository();

      await repo.save(user(), 'super_admin');

      expect(pgCtx.contexts[0]).toEqual({ restaurantId: 'rosto', actorRole: 'super_admin' });
    });

    it('save without actorRole omits app.actor_role from the tenant context', async () => {
      const repo = new PgUserRepository();

      await repo.save(user());

      expect(pgCtx.contexts[0]).toEqual({ restaurantId: 'rosto' });
    });

    it('findAll with actorRole super_admin passes it into the tenant context', async () => {
      const repo = new PgUserRepository();

      await repo.findAll('super_admin');

      expect(pgCtx.contexts[0]).toEqual({ restaurantId: null, actorRole: 'super_admin' });
    });

    it('findAll without actorRole runs with no app.actor_role GUC (RLS with caller identity)', async () => {
      const repo = new PgUserRepository();

      await repo.findAll();

      expect(pgCtx.contexts[0]).toEqual({ restaurantId: null });
    });
  });
});
