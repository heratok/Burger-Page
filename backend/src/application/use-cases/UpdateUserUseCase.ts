import { UserRepository } from '../../domain/ports/out/UserRepository.js';
import { RestaurantRepository } from '../../domain/ports/out/RestaurantRepository.js';
import { ConflictError, EntityNotFoundError, ValidationError } from '../../domain/errors/DomainErrors.js';
import { User, UserRole } from '../../domain/models/User.js';
import { assertGuardedChangeAllowed, assertNotSelf } from './userGuards.js';

export interface UpdateUserInput {
  actorId: string;
  targetId: string;
  username?: string;
  role?: UserRole;
  restaurantId?: string | null;
  isActive?: boolean;
}

/**
 * Super admin edit of an existing user: username, role, restaurant and the
 * active flag. The password is never touched (use reset-password). Sessions
 * need no revocation: resolveSession re-reads role/restaurantId from storage
 * on every request, so an edit applies to tokens already issued.
 */
export class UpdateUserUseCase {
  constructor(
    private userRepo: UserRepository,
    private restaurantRepo: RestaurantRepository
  ) {}

  async execute(input: UpdateUserInput): Promise<User> {
    const { actorId, targetId } = input;
    if (
      input.username === undefined &&
      input.role === undefined &&
      input.restaurantId === undefined &&
      input.isActive === undefined
    ) {
      throw new ValidationError('Nothing to update: send username, role, restaurantId or isActive');
    }

    const target = await this.userRepo.findById(targetId);
    if (!target) {
      throw new EntityNotFoundError(`User '${targetId}' not found`);
    }

    const username = input.username === undefined ? undefined : input.username.trim();
    if (username !== undefined && !username) {
      throw new ValidationError('Username is required');
    }

    const role = input.role ?? target.role;
    let restaurantId: string | null;
    if (role === 'super_admin') {
      // A platform account has no tenant: reject an explicit one, clear a stale one.
      if (input.restaurantId) {
        throw new ValidationError('A super_admin cannot be assigned to a restaurant');
      }
      restaurantId = null;
    } else {
      const wanted = input.restaurantId === undefined ? target.restaurantId : input.restaurantId;
      if (!wanted) {
        throw new ValidationError('restaurantId is required for restaurant_admin role');
      }
      // findById hides deleted tenants. A paused tenant is a valid home: the
      // super admin may be preparing it before reopening it.
      if (!(await this.restaurantRepo.findById(wanted))) {
        throw new EntityNotFoundError(`Restaurant '${wanted}' not found`);
      }
      restaurantId = wanted;
    }

    const demoting = target.role === 'super_admin' && role !== 'super_admin';
    if (demoting && actorId === target.id) {
      throw new ConflictError('You cannot demote your own account');
    }
    if (input.isActive === false) {
      assertNotSelf(actorId, target, 'deactivate');
    }

    if (username !== undefined && username !== target.username) {
      const owner = await this.userRepo.findByUsername(username);
      if (owner && owner.id !== target.id) {
        throw new ConflictError(`Username "${username}" already exists`);
      }
    }

    // Atomic in the repository: the last-active-super-admin check and the
    // write cannot be split by a concurrent request.
    const outcome = await this.userRepo.updateGuarded(targetId, {
      ...(username !== undefined && username !== target.username ? { username } : {}),
      ...(role !== target.role ? { role } : {}),
      ...((restaurantId ?? undefined) !== target.restaurantId ? { restaurantId } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    });
    if (outcome === 'not_found') {
      throw new EntityNotFoundError(`User '${targetId}' not found`);
    }
    if (outcome === 'username_taken') {
      throw new ConflictError(`Username "${username}" already exists`);
    }
    assertGuardedChangeAllowed(outcome, demoting ? 'demote' : 'deactivate');

    const updated = await this.userRepo.findById(targetId);
    if (!updated) {
      throw new EntityNotFoundError(`User '${targetId}' not found`);
    }
    return updated;
  }
}
