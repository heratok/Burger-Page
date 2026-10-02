import { UserRepository } from '../../domain/ports/out/UserRepository.js';
import { EntityNotFoundError } from '../../domain/errors/DomainErrors.js';
import { assertGuardedChangeAllowed, assertNotSelf } from './userGuards.js';

export interface DeleteUserInput {
  actorId: string;
  targetId: string;
}

export class DeleteUserUseCase {
  constructor(private userRepo: UserRepository) {}

  async execute({ actorId, targetId }: DeleteUserInput): Promise<void> {
    const target = await this.userRepo.findById(targetId);
    if (!target) {
      throw new EntityNotFoundError(`User '${targetId}' not found`);
    }
    assertNotSelf(actorId, target, 'delete');
    const outcome = await this.userRepo.deleteGuarded(targetId);
    if (outcome === 'not_found') {
      throw new EntityNotFoundError(`User '${targetId}' not found`);
    }
    assertGuardedChangeAllowed(outcome, 'delete');
  }
}
