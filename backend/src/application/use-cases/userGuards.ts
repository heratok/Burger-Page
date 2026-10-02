import { User } from '../../domain/models/User.js';
import { ConflictError } from '../../domain/errors/DomainErrors.js';
import { GuardedUserChange } from '../../domain/ports/out/UserRepository.js';

/**
 * Guards for actions that remove a user's ability to sign in (deactivate,
 * delete). A super admin can never lock itself out (checked here), and the last
 * active super admin can never go: that second rule is enforced atomically by
 * the repository (setActive / deleteGuarded), not by a read-then-write here.
 */
export function assertNotSelf(actorId: string, target: User, verb: 'deactivate' | 'delete'): void {
  if (actorId === target.id) {
    throw new ConflictError(`You cannot ${verb} your own account`);
  }
}

export function assertGuardedChangeAllowed(outcome: GuardedUserChange, verb: 'deactivate' | 'delete'): void {
  if (outcome === 'last_super_admin') {
    throw new ConflictError(`Cannot ${verb} the last active super admin`);
  }
}
