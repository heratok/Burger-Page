import { UserRepository } from '../../domain/ports/out/UserRepository.js';
import { RestaurantRepository } from '../../domain/ports/out/RestaurantRepository.js';
import { RoleRepository } from '../../domain/ports/out/RoleRepository.js';
import { ConflictError, EntityNotFoundError, ForbiddenError, ValidationError } from '../../domain/errors/DomainErrors.js';
import { User, UserRole } from '../../domain/models/User.js';
import {
  assertGuardedChangeAllowed,
  assertManagerMayTouch,
  assertNotSelf,
  assertWithinManagerPermissions,
  isPlatformManager,
  loadAssignableRole,
  UserManager,
} from './userGuards.js';
import { AdminAuditRecorder, AuditActor } from '../services/AdminAuditRecorder.js';
import { diffFields } from '../../domain/shared/auditDetails.js';

export interface UpdateUserInput {
  actorId: string;
  targetId: string;
  username?: string;
  role?: UserRole;
  restaurantId?: string | null;
  isActive?: boolean;
  /** Custom role (restaurant_staff only). */
  roleId?: string;
  /** Who performs the edit (audit trail). */
  actor?: AuditActor;
  /** The authenticated caller; a tenant caller may only edit staff of its own restaurant (username, isActive, roleId). */
  manager?: UserManager;
}

/**
 * Edit of an existing user: username, role, restaurant, custom role and the
 * active flag. The password is never touched (use reset-password). Sessions
 * need no revocation: resolveSession re-reads role/restaurantId/role
 * permissions from storage on every request, so an edit applies to tokens
 * already issued. A super admin can edit anyone; a tenant caller is confined
 * by assertManagerMayTouch and cannot change role or restaurant.
 */
export class UpdateUserUseCase {
  constructor(
    private userRepo: UserRepository,
    private restaurantRepo: RestaurantRepository,
    private audit?: AdminAuditRecorder,
    private roleRepo?: RoleRepository
  ) {}

  async execute(input: UpdateUserInput): Promise<User> {
    const { actorId, targetId } = input;
    if (
      input.username === undefined &&
      input.role === undefined &&
      input.restaurantId === undefined &&
      input.roleId === undefined &&
      input.isActive === undefined
    ) {
      throw new ValidationError('Nothing to update: send username, role, restaurantId, roleId or isActive');
    }

    const target = await this.userRepo.findById(targetId);
    if (!target) {
      throw new EntityNotFoundError(`User '${targetId}' not found`);
    }

    const tenantCaller = !isPlatformManager(input.manager);
    await assertManagerMayTouch(input.manager, target, this.roleRepo);
    if (tenantCaller) {
      if (input.role !== undefined && input.role !== target.role) {
        throw new ForbiddenError('Restaurant users cannot change the account role');
      }
      if (input.restaurantId !== undefined && input.restaurantId !== target.restaurantId) {
        throw new ForbiddenError('Restaurant users cannot move an account to another restaurant');
      }
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

    // Custom role: staff must hold one of THEIR restaurant's roles; every other
    // role carries none (cleared on promotion).
    let roleId: string | null | undefined;
    if (role === 'restaurant_staff') {
      if (input.roleId !== undefined || target.role !== 'restaurant_staff' || restaurantId !== target.restaurantId) {
        const assignable = await loadAssignableRole(this.roleRepo, input.roleId ?? target.roleId, restaurantId!);
        if (input.manager && input.manager.role === 'restaurant_staff') {
          assertWithinManagerPermissions(input.manager, assignable.permissions, 'The role');
        }
        roleId = assignable.id;
      }
    } else {
      if (input.roleId !== undefined) {
        throw new ValidationError('roleId only applies to restaurant_staff users');
      }
      roleId = target.roleId !== undefined ? null : undefined;
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
      ...(roleId !== undefined && (roleId ?? undefined) !== target.roleId ? { roleId } : {}),
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
    await this.recordAudit(input.actor, target, updated);
    return updated;
  }

  private async recordAudit(actor: AuditActor | undefined, before: User, after: User): Promise<void> {
    if (!this.audit) return;
    const flat = (u: User) => ({ username: u.username, role: u.role, restaurantId: u.restaurantId ?? null, roleId: u.roleId ?? null });
    const diff = diffFields(flat(before), flat(after), ['username', 'role', 'restaurantId', 'roleId']);
    const wasActive = before.isActive !== false;
    const isActive = after.isActive !== false;
    const target = {
      targetType: 'user' as const,
      targetId: after.id,
      targetLabel: after.username,
      restaurantId: after.restaurantId ?? null,
    };
    if (wasActive !== isActive) {
      await this.audit.record(actor, {
        ...target,
        action: isActive ? 'user.activate' : 'user.deactivate',
        details: { from: wasActive, to: isActive },
      });
    }
    if (diff.changedFields.length > 0) {
      await this.audit.record(actor, { ...target, action: 'user.update', details: diff });
    }
  }
}
