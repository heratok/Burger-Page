import { UserRepository } from '../../domain/ports/out/UserRepository.js';
import { User } from '../../domain/models/User.js';
import { ConflictError } from '../../domain/errors/DomainErrors.js';

/**
 * Shared guards for actions that remove a user's ability to sign in
 * (deactivate, delete). They keep the platform administrable: a super admin
 * can never lock itself out, and the last active super admin can never go.
 */
export async function assertCanRemoveAccess(
  userRepo: UserRepository,
  actorId: string,
  target: User,
  verb: 'deactivate' | 'delete'
): Promise<void> {
  if (actorId === target.id) {
    throw new ConflictError(`You cannot ${verb} your own account`);
  }
  if (target.role !== 'super_admin' || target.isActive === false) {
    return;
  }
  const users = await userRepo.findAll('super_admin');
  const otherActiveSuperAdmins = users.filter(
    (u) => u.role === 'super_admin' && u.isActive !== false && u.id !== target.id
  );
  if (otherActiveSuperAdmins.length === 0) {
    throw new ConflictError(`Cannot ${verb} the last active super admin`);
  }
}
