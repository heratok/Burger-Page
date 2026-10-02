import { UserRepository } from '../../domain/ports/out/UserRepository.js';
import { EntityNotFoundError } from '../../domain/errors/DomainErrors.js';
import { assertCanRemoveAccess } from './userGuards.js';

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
    await assertCanRemoveAccess(this.userRepo, actorId, target, 'delete');
    await this.userRepo.delete(targetId, 'super_admin');
  }
}
