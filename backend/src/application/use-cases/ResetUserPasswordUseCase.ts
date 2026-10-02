import { randomBytes } from 'node:crypto';
import { UserRepository } from '../../domain/ports/out/UserRepository.js';
import { PasswordHasher } from '../../domain/ports/out/PasswordHasher.js';
import { EntityNotFoundError } from '../../domain/errors/DomainErrors.js';

export interface ResetUserPasswordInput {
  targetId: string;
}

/** 128 bits of CSPRNG output, base64url (22 chars). Shown once, never stored in clear. */
const generateTemporaryPassword = (): string => randomBytes(16).toString('base64url');

export class ResetUserPasswordUseCase {
  constructor(
    private userRepo: UserRepository,
    private hasher: PasswordHasher,
    private generatePassword: () => string = generateTemporaryPassword
  ) {}

  async execute({ targetId }: ResetUserPasswordInput): Promise<{ temporaryPassword: string }> {
    const target = await this.userRepo.findById(targetId);
    if (!target) {
      throw new EntityNotFoundError(`User '${targetId}' not found`);
    }
    const temporaryPassword = this.generatePassword();
    const passwordHash = await this.hasher.hash(temporaryPassword);
    await this.userRepo.save({ ...target, passwordHash, mustChangePassword: true }, 'super_admin');
    return { temporaryPassword };
  }
}
