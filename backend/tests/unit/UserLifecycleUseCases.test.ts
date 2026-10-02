import { describe, it, expect, beforeEach } from 'vitest';
import { SetUserActiveUseCase } from '../../src/application/use-cases/SetUserActiveUseCase.js';
import { DeleteUserUseCase } from '../../src/application/use-cases/DeleteUserUseCase.js';
import { ResetUserPasswordUseCase } from '../../src/application/use-cases/ResetUserPasswordUseCase.js';
import { ChangeOwnPasswordUseCase } from '../../src/application/use-cases/ChangeOwnPasswordUseCase.js';
import { AuthenticateUserUseCase } from '../../src/application/use-cases/AuthenticateUserUseCase.js';
import { CryptoPasswordHasher } from '../../src/infrastructure/security/CryptoPasswordHasher.js';
import { JwtService } from '../../src/infrastructure/security/JwtService.js';
import { InMemoryUserRepository } from '../../src/infrastructure/persistence/InMemoryUserRepository.js';
import { ConflictError, EntityNotFoundError, UnauthorizedError, ValidationError } from '../../src/domain/errors/DomainErrors.js';
import type { User } from '../../src/domain/models/User.js';

const hasher = new CryptoPasswordHasher();

async function seed(repo: InMemoryUserRepository, partial: Partial<User> & { id: string; username: string }, password = 'password-1'): Promise<User> {
  const user: User = {
    passwordHash: await hasher.hash(password),
    role: 'restaurant_admin',
    restaurantId: 'rest-a',
    createdAt: new Date().toISOString(),
    isActive: true,
    ...partial,
  };
  await repo.save(user);
  return user;
}

describe('User lifecycle use cases', () => {
  let repo: InMemoryUserRepository;

  beforeEach(async () => {
    repo = new InMemoryUserRepository();
    // Start from a controlled directory, not the demo seed.
    for (const u of await repo.findAll()) await repo.delete(u.id);
    await seed(repo, { id: 'sa-1', username: 'root', role: 'super_admin', restaurantId: undefined });
    await seed(repo, { id: 'ra-1', username: 'owner' });
  });

  describe('SetUserActiveUseCase', () => {
    it('deactivates and reactivates a user', async () => {
      const uc = new SetUserActiveUseCase(repo);
      await uc.execute({ actorId: 'sa-1', targetId: 'ra-1', isActive: false });
      expect((await repo.findById('ra-1'))?.isActive).toBe(false);
      await uc.execute({ actorId: 'sa-1', targetId: 'ra-1', isActive: true });
      expect((await repo.findById('ra-1'))?.isActive).toBe(true);
    });

    it('throws EntityNotFoundError for an unknown id', async () => {
      await expect(new SetUserActiveUseCase(repo).execute({ actorId: 'sa-1', targetId: 'nope', isActive: false }))
        .rejects.toThrow(EntityNotFoundError);
    });

    it('refuses to let a super admin deactivate itself', async () => {
      await seed(repo, { id: 'sa-2', username: 'root2', role: 'super_admin', restaurantId: undefined });
      await expect(new SetUserActiveUseCase(repo).execute({ actorId: 'sa-1', targetId: 'sa-1', isActive: false }))
        .rejects.toThrow(ConflictError);
    });

    it('refuses to deactivate the last active super admin', async () => {
      await expect(new SetUserActiveUseCase(repo).execute({ actorId: 'ghost', targetId: 'sa-1', isActive: false }))
        .rejects.toThrow(ConflictError);
    });

    it('allows deactivating a super admin when another active one remains', async () => {
      await seed(repo, { id: 'sa-2', username: 'root2', role: 'super_admin', restaurantId: undefined });
      await new SetUserActiveUseCase(repo).execute({ actorId: 'sa-2', targetId: 'sa-1', isActive: false });
      expect((await repo.findById('sa-1'))?.isActive).toBe(false);
    });

    it('does not count an inactive super admin as a remaining one', async () => {
      await seed(repo, { id: 'sa-2', username: 'root2', role: 'super_admin', restaurantId: undefined, isActive: false });
      await expect(new SetUserActiveUseCase(repo).execute({ actorId: 'ghost', targetId: 'sa-1', isActive: false }))
        .rejects.toThrow(ConflictError);
    });
  });

  describe('DeleteUserUseCase', () => {
    it('deletes a user', async () => {
      await new DeleteUserUseCase(repo).execute({ actorId: 'sa-1', targetId: 'ra-1' });
      expect(await repo.findById('ra-1')).toBeNull();
    });

    it('throws EntityNotFoundError for an unknown id', async () => {
      await expect(new DeleteUserUseCase(repo).execute({ actorId: 'sa-1', targetId: 'nope' }))
        .rejects.toThrow(EntityNotFoundError);
    });

    it('refuses self deletion', async () => {
      await seed(repo, { id: 'sa-2', username: 'root2', role: 'super_admin', restaurantId: undefined });
      await expect(new DeleteUserUseCase(repo).execute({ actorId: 'sa-1', targetId: 'sa-1' }))
        .rejects.toThrow(ConflictError);
      expect(await repo.findById('sa-1')).not.toBeNull();
    });

    it('refuses to delete the last active super admin', async () => {
      await expect(new DeleteUserUseCase(repo).execute({ actorId: 'ghost', targetId: 'sa-1' }))
        .rejects.toThrow(ConflictError);
      expect(await repo.findById('sa-1')).not.toBeNull();
    });
  });

  describe('ResetUserPasswordUseCase', () => {
    it('returns a strong one-time password, replaces the hash and flags the change', async () => {
      const uc = new ResetUserPasswordUseCase(repo, hasher);
      const { temporaryPassword } = await uc.execute({ targetId: 'ra-1' });
      expect(temporaryPassword.length).toBeGreaterThanOrEqual(12);

      const stored = await repo.findById('ra-1');
      expect(stored?.mustChangePassword).toBe(true);
      expect(await hasher.verify(temporaryPassword, stored!.passwordHash)).toBe(true);
      expect(await hasher.verify('password-1', stored!.passwordHash)).toBe(false);
    });

    it('generates a different password every time', async () => {
      const uc = new ResetUserPasswordUseCase(repo, hasher);
      const a = await uc.execute({ targetId: 'ra-1' });
      const b = await uc.execute({ targetId: 'ra-1' });
      expect(a.temporaryPassword).not.toBe(b.temporaryPassword);
    });

    it('throws EntityNotFoundError for an unknown id', async () => {
      await expect(new ResetUserPasswordUseCase(repo, hasher).execute({ targetId: 'nope' }))
        .rejects.toThrow(EntityNotFoundError);
    });
  });

  describe('ChangeOwnPasswordUseCase', () => {
    const jwt = new JwtService('unit-test-secret');

    it('replaces the hash, clears the flag and returns a fresh token', async () => {
      await new ResetUserPasswordUseCase(repo, hasher).execute({ targetId: 'ra-1' });
      const uc = new ChangeOwnPasswordUseCase(repo, hasher, jwt);
      const stored = await repo.findById('ra-1');
      // Reset again with a known password so the current password is known.
      await repo.save({ ...stored!, passwordHash: await hasher.hash('temp-password-1'), mustChangePassword: true });

      const { token } = await uc.execute({ userId: 'ra-1', currentPassword: 'temp-password-1', newPassword: 'brand-new-pass' });

      const after = await repo.findById('ra-1');
      expect(after?.mustChangePassword).toBe(false);
      expect(await hasher.verify('brand-new-pass', after!.passwordHash)).toBe(true);
      expect(jwt.verifyToken(token).mustChangePassword).toBeFalsy();
    });

    it('rejects a wrong current password with ValidationError and changes nothing', async () => {
      const before = (await repo.findById('ra-1'))!.passwordHash;
      await expect(new ChangeOwnPasswordUseCase(repo, hasher, jwt).execute({ userId: 'ra-1', currentPassword: 'wrong-wrong', newPassword: 'brand-new-pass' }))
        .rejects.toThrow(ValidationError);
      expect((await repo.findById('ra-1'))!.passwordHash).toBe(before);
    });

    it('rejects a new password shorter than 8 characters', async () => {
      await expect(new ChangeOwnPasswordUseCase(repo, hasher, jwt).execute({ userId: 'ra-1', currentPassword: 'password-1', newPassword: 'short' }))
        .rejects.toThrow(ValidationError);
    });

    it('rejects a new password equal to the current one', async () => {
      await expect(new ChangeOwnPasswordUseCase(repo, hasher, jwt).execute({ userId: 'ra-1', currentPassword: 'password-1', newPassword: 'password-1' }))
        .rejects.toThrow(ValidationError);
    });

    it('throws EntityNotFoundError when the account no longer exists', async () => {
      await expect(new ChangeOwnPasswordUseCase(repo, hasher, jwt).execute({ userId: 'nope', currentPassword: 'password-1', newPassword: 'brand-new-pass' }))
        .rejects.toThrow(EntityNotFoundError);
    });
  });

  describe('AuthenticateUserUseCase', () => {
    it('exposes mustChangePassword on the result and in the token claims', async () => {
      await new ResetUserPasswordUseCase(repo, hasher).execute({ targetId: 'ra-1' });
      const stored = await repo.findById('ra-1');
      await repo.save({ ...stored!, passwordHash: await hasher.hash('temp-password-1') });
      const jwt = new JwtService('unit-test-secret');
      const result = await new AuthenticateUserUseCase(repo, hasher, jwt).execute('owner', 'temp-password-1');

      expect(result.user?.mustChangePassword).toBe(true);
      expect(jwt.verifyToken(result.token!).mustChangePassword).toBe(true);
    });

    it('reports mustChangePassword false for a normal login', async () => {
      const jwt = new JwtService('unit-test-secret');
      const result = await new AuthenticateUserUseCase(repo, hasher, jwt).execute('owner', 'password-1');
      expect(result.user?.mustChangePassword).toBe(false);
      expect(jwt.verifyToken(result.token!).mustChangePassword).toBeFalsy();
    });

    it('still rejects a deactivated user', async () => {
      await new SetUserActiveUseCase(repo).execute({ actorId: 'sa-1', targetId: 'ra-1', isActive: false });
      await expect(new AuthenticateUserUseCase(repo, hasher).execute('owner', 'password-1')).rejects.toThrow(UnauthorizedError);
    });
  });
});
