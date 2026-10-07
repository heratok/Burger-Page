import { randomBytes } from 'node:crypto';
import { UserRepository } from '../../domain/ports/out/UserRepository.js';
import { PasswordHasher } from '../../domain/ports/out/PasswordHasher.js';
import { EntityNotFoundError } from '../../domain/errors/DomainErrors.js';
import { RoleRepository } from '../../domain/ports/out/RoleRepository.js';
import { AdminAuditRecorder, AuditActor } from '../services/AdminAuditRecorder.js';
import { assertManagerMayTouch, UserManager } from './userGuards.js';

export interface ResetUserPasswordInput {
  targetId: string;
  /** Who resets it (audit trail). */
  actor?: AuditActor;
  /** The authenticated caller; a tenant caller may only reset staff of its own restaurant. */
  manager?: UserManager;
}

/** 128 bits of CSPRNG output, base64url (22 chars). Shown once, never stored in clear. */
const generateTemporaryPassword = (): string => randomBytes(16).toString('base64url');

export class ResetUserPasswordUseCase {
  constructor(
    private userRepo: UserRepository,
    private hasher: PasswordHasher,
    private generatePassword: () => string = generateTemporaryPassword,
    private audit?: AdminAuditRecorder,
    private roleRepo?: RoleRepository
  ) {}

  async execute({ targetId, actor, manager }: ResetUserPasswordInput): Promise<{ temporaryPassword: string }> {
    const target = await this.userRepo.findById(targetId);
    if (!target) {
      throw new EntityNotFoundError(`User '${targetId}' not found`);
    }
    await assertManagerMayTouch(manager, target, this.roleRepo);
    const temporaryPassword = this.generatePassword();
    const passwordHash = await this.hasher.hash(temporaryPassword);
    await this.userRepo.save({ ...target, passwordHash, mustChangePassword: true, passwordChangedAt: new Date().toISOString() }, 'super_admin');
    // The temporary password is returned once to the caller and never recorded.
    await this.audit?.record(actor, {
      action: 'user.reset_password',
      targetType: 'user',
      targetId: target.id,
      targetLabel: target.username,
      restaurantId: target.restaurantId ?? null,
      details: { username: target.username },
    });
    return { temporaryPassword };
  }
}
