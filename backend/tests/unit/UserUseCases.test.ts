import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateUserUseCase } from '../../src/application/use-cases/CreateUserUseCase.js';
import { AuthenticateUserUseCase } from '../../src/application/use-cases/AuthenticateUserUseCase.js';
import { ListUsersUseCase } from '../../src/application/use-cases/ListUsersUseCase.js';
import { UserRepository } from '../../src/domain/ports/out/UserRepository.js';
import { PasswordHasher } from '../../src/domain/ports/out/PasswordHasher.js';
import { ValidationError, UnauthorizedError } from '../../src/domain/errors/DomainErrors.js';
import type { User } from '../../src/domain/models/User.js';

describe('User Use Cases', () => {
  let mockUserRepo: UserRepository;
  let mockHasher: PasswordHasher;

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
  });

  // ─────────────────────────────────────────────────────────
  // CreateUserUseCase
  // ─────────────────────────────────────────────────────────
  describe('CreateUserUseCase', () => {
    it('should create a user with a hashed password', async () => {
      const useCase = new CreateUserUseCase(mockUserRepo, mockHasher);
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
      expect(mockUserRepo.save).toHaveBeenCalledWith(result);
    });

    it('should throw ValidationError when username is empty', async () => {
      const useCase = new CreateUserUseCase(mockUserRepo, mockHasher);

      await expect(
        useCase.execute({
          username: '   ',
          password: 'securePass123',
          role: 'super_admin',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when password is shorter than 6 characters', async () => {
      const useCase = new CreateUserUseCase(mockUserRepo, mockHasher);

      await expect(
        useCase.execute({
          username: 'admin',
          password: '123',
          role: 'super_admin',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when restaurant_admin has no restaurantId', async () => {
      const useCase = new CreateUserUseCase(mockUserRepo, mockHasher);

      await expect(
        useCase.execute({
          username: 'admin_local',
          password: 'securePass123',
          role: 'restaurant_admin',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when username already exists', async () => {
      const useCase = new CreateUserUseCase(mockUserRepo, mockHasher);
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

    it('should allow super_admin creation without restaurantId', async () => {
      const useCase = new CreateUserUseCase(mockUserRepo, mockHasher);
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

    it('should filter users by restaurantId', async () => {
      const useCase = new ListUsersUseCase(mockUserRepo);
      vi.mocked(mockUserRepo.findByRestaurantId).mockResolvedValue([users[1]]);

      const result = await useCase.execute('rosto');

      expect(result).toHaveLength(1);
      expect(result[0].username).toBe('admin_rosto');
      expect(mockUserRepo.findByRestaurantId).toHaveBeenCalledWith('rosto');
    });
  });
});
