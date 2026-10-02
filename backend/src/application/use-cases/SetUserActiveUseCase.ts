import { UserRepository } from '../../domain/ports/out/UserRepository.js';
import { EntityNotFoundError } from '../../domain/errors/DomainErrors.js';
import { User } from '../../domain/models/User.js';
import { assertCanRemoveAccess } from './userGuards.js';

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
      await assertCanRemoveAccess(this.userRepo, actorId, target, 'deactivate');
    }
    const updated: User = { ...target, isActive };
    await this.userRepo.save(updated, 'super_admin');
    return updated;
  }
}
