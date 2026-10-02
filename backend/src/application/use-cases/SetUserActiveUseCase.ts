import { UserRepository } from '../../domain/ports/out/UserRepository.js';
import { EntityNotFoundError } from '../../domain/errors/DomainErrors.js';
import { User } from '../../domain/models/User.js';
import { assertGuardedChangeAllowed, assertNotSelf } from './userGuards.js';

export interface SetUserActiveInput {
  actorId: string;
  targetId: string;
  isActive: boolean;
}

export class SetUserActiveUseCase {
  constructor(private userRepo: UserRepository) {}

  async execute({ actorId, targetId, isActive }: SetUserActiveInput): Promise<User> {
    const target = await this.userRepo.findById(targetId);
    if (!target) {
      throw new EntityNotFoundError(`User '${targetId}' not found`);
    }
    if (!isActive) {
      assertNotSelf(actorId, target, 'deactivate');
    }
    // Atomic in the repository: only is_active changes, and the last active
    // super admin cannot be deactivated even under concurrent requests.
    const outcome = await this.userRepo.setActive(targetId, isActive);
    if (outcome === 'not_found') {
      throw new EntityNotFoundError(`User '${targetId}' not found`);
    }
    assertGuardedChangeAllowed(outcome, 'deactivate');
    return (await this.userRepo.findById(targetId)) ?? { ...target, isActive };
  }
}
