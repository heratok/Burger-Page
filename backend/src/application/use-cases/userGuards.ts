import { User, UserRole } from '../../domain/models/User.js';
import { Role } from '../../domain/models/Role.js';
import { ConflictError, EntityNotFoundError, ForbiddenError, ValidationError } from '../../domain/errors/DomainErrors.js';
import { GuardedUserChange } from '../../domain/ports/out/UserRepository.js';
import { RoleRepository } from '../../domain/ports/out/RoleRepository.js';

/**
 * The authenticated caller of a user-management use case. `undefined` stands
 * for a trusted caller (scripts, super admin flows); a super_admin is trusted
 * too. Tenant callers (restaurant_admin, or restaurant_staff delegated
 * users.manage) are confined to staff users of their own restaurant.
 */
export interface UserManager {
  userId: string;
  role: UserRole;
  restaurantId?: string;
  permissions: readonly string[];
}

export function isPlatformManager(manager: UserManager | undefined): boolean {
  return !manager || manager.role === 'super_admin';
}

/**
 * A staff manager may only hand out (or touch) what it holds itself, so
 * delegating users.manage/roles.manage can never be used to escalate.
 * restaurant_admin holds the whole catalog, so the check always passes for it.
 */
export function assertWithinManagerPermissions(manager: UserManager, permissions: readonly string[], what: string): void {
  const held = new Set(manager.permissions);
  if (!permissions.every((p) => held.has(p))) {
    throw new ForbiddenError(`${what} grants permissions you do not hold`);
  }
}

/** The role a user is being assigned must exist in the target restaurant (404 otherwise, never revealing other tenants). */
export async function loadAssignableRole(
  roleRepo: RoleRepository | undefined,
  roleId: string | undefined,
  restaurantId: string
): Promise<Role> {
  if (!roleId) {
    throw new ValidationError('roleId is required for restaurant_staff users');
  }
  const role = roleRepo ? await roleRepo.findById(roleId, restaurantId) : null;
  if (!role) {
    throw new EntityNotFoundError(`Role '${roleId}' not found in this restaurant`);
  }
  return role;
}

/**
 * Gate for update/delete/reset-password on an existing user. Tenant managers
 * can only reach restaurant_staff users of their own restaurant: other tenants
 * look non-existent (404), and same-tenant admins are refused (403). A staff
 * manager additionally cannot act on itself nor on a user holding more
 * permissions than it does (that would be an account takeover/escalation).
 */
export async function assertManagerMayTouch(
  manager: UserManager | undefined,
  target: User,
  roleRepo?: RoleRepository
): Promise<void> {
  if (isPlatformManager(manager)) return;
  const m = manager!;
  if (!m.restaurantId || target.restaurantId !== m.restaurantId) {
    throw new EntityNotFoundError(`User '${target.id}' not found`);
  }
  if (m.role !== 'restaurant_admin' && m.role !== 'restaurant_staff') {
    throw new ForbiddenError('Not allowed to manage users');
  }
  if (!m.permissions.includes('users.manage')) {
    throw new ForbiddenError('Missing permission: users.manage');
  }
  if (target.role !== 'restaurant_staff') {
    throw new ForbiddenError('Only staff users can be managed from a restaurant');
  }
  if (m.role === 'restaurant_staff') {
    if (m.userId === target.id) {
      throw new ForbiddenError('You cannot manage your own account');
    }
    const targetRole = roleRepo && target.roleId ? await roleRepo.findById(target.roleId, m.restaurantId) : null;
    assertWithinManagerPermissions(m, targetRole?.permissions ?? [], 'The target user\'s role');
  }
}

/**
 * Guards for actions that remove a user's ability to sign in or act as a super
 * admin (deactivate, delete, demote). A super admin can never lock itself out (checked here), and the last
 * active super admin can never go: that second rule is enforced atomically by
 * the repository (setActive / deleteGuarded / updateGuarded), not by a read-then-write here.
 */
export function assertNotSelf(actorId: string, target: User, verb: 'deactivate' | 'delete'): void {
  if (actorId === target.id) {
    throw new ConflictError(`You cannot ${verb} your own account`);
  }
}

export function assertGuardedChangeAllowed(outcome: GuardedUserChange, verb: 'deactivate' | 'delete' | 'demote'): void {
  if (outcome === 'last_super_admin') {
    throw new ConflictError(`Cannot ${verb} the last active super admin`);
  }
}
