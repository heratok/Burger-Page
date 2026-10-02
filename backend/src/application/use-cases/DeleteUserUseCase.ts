import { UserRepository } from '../../domain/ports/out/UserRepository.js';
import { EntityNotFoundError } from '../../domain/errors/DomainErrors.js';
import { assertGuardedChangeAllowed, assertNotSelf } from './userGuards.js';
import { AdminAuditRecorder, AuditActor } from '../services/AdminAuditRecorder.js';

export interface DeleteUserInput {
  actorId: string;
  targetId: string;
  /** Who deletes it (audit trail). */
  actor?: AuditActor;
}

export class DeleteUserUseCase {
  constructor(
    private userRepo: UserRepository,
    private audit?: AdminAuditRecorder
  ) {}

  async execute({ actorId, targetId, actor }: DeleteUserInput): Promise<void> {
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
    await this.audit?.record(actor, {
      action: 'user.delete',
      targetType: 'user',
      targetId: target.id,
      targetLabel: target.username,
      restaurantId: target.restaurantId ?? null,
      details: { username: target.username, role: target.role },
    });
  }
}
