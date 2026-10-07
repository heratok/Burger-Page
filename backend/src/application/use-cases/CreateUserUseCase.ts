import { ID_PREFIX, newId } from '../../domain/shared/newId.js';
import { UserRepository } from '../../domain/ports/out/UserRepository.js';
import { PasswordHasher } from '../../domain/ports/out/PasswordHasher.js';
import { RestaurantRepository } from '../../domain/ports/out/RestaurantRepository.js';
import { RoleRepository } from '../../domain/ports/out/RoleRepository.js';
import { ValidationError, EntityNotFoundError, ForbiddenError } from '../../domain/errors/DomainErrors.js';
import { User, UserRole, MIN_PASSWORD_LENGTH } from '../../domain/models/User.js';
import { CreateUserDTO } from '../dtos/index.js';
import { AdminAuditRecorder, AuditActor } from '../services/AdminAuditRecorder.js';
import { assertWithinManagerPermissions, isPlatformManager, loadAssignableRole, UserManager } from './userGuards.js';

export class CreateUserUseCase {
  constructor(
    private userRepo: UserRepository,
    private hasher: PasswordHasher,
    private restaurantRepo: RestaurantRepository,
    private audit?: AdminAuditRecorder,
    private roleRepo?: RoleRepository
  ) {}

  /**
   * `manager` is the authenticated caller. A super admin (or no manager, for
   * scripts) may create any account. A tenant caller (restaurant_admin, or
   * staff delegated users.manage) can only create restaurant_staff users in
   * its OWN restaurant, with a role of that restaurant whose permissions it
   * holds itself.
   */
  async execute(dto: CreateUserDTO, callerRole?: UserRole, actor?: AuditActor, manager?: UserManager): Promise<User> {
    const tenantCaller = !isPlatformManager(manager);
    if (tenantCaller) {
      if (!manager!.permissions.includes('users.manage')) {
        throw new ForbiddenError('Missing permission: users.manage');
      }
      if (dto.role !== 'restaurant_staff') {
        throw new ForbiddenError('Restaurant users can only create staff accounts');
      }
      if (!manager!.restaurantId || (dto.restaurantId && dto.restaurantId !== manager!.restaurantId)) {
        throw new ForbiddenError('You can only create users for your own restaurant');
      }
    }

    const username = dto.username.trim();
    if (!username) {
      throw new ValidationError('Username is required');
    }

    if (dto.password.length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    const restaurantId = tenantCaller ? manager!.restaurantId : dto.restaurantId;
    const tenantBound = dto.role === 'restaurant_admin' || dto.role === 'restaurant_staff';

    if (tenantBound) {
      if (!restaurantId) {
        throw new ValidationError(`restaurantId is required for ${dto.role} role`);
      }
      const restaurant = await this.restaurantRepo.findById(restaurantId);
      if (!restaurant || restaurant.isActive === false) {
        throw new EntityNotFoundError(`Restaurant '${restaurantId}' not found or inactive`);
      }
    }

    let roleId: string | undefined;
    if (dto.role === 'restaurant_staff') {
      const role = await loadAssignableRole(this.roleRepo, dto.roleId, restaurantId!);
      if (tenantCaller && manager!.role === 'restaurant_staff') {
        assertWithinManagerPermissions(manager!, role.permissions, 'The role');
      }
      roleId = role.id;
    }

    const existing = await this.userRepo.findByUsername(username);
    if (existing) {
      throw new ValidationError(`Username "${username}" already exists`);
    }

    const passwordHash = await this.hasher.hash(dto.password);

    const user: User = {
      id: newId(ID_PREFIX.user),
      username,
      passwordHash,
      role: dto.role,
      restaurantId: tenantBound ? restaurantId : undefined,
      ...(roleId ? { roleId } : {}),
      createdAt: new Date().toISOString(),
      // The creator chose this password, so the account owner must replace it at first login.
      mustChangePassword: true,
    };

    await this.userRepo.save(user, manager?.role ?? callerRole);
    await this.audit?.record(actor, {
      action: 'user.create',
      targetType: 'user',
      targetId: user.id,
      targetLabel: user.username,
      restaurantId: user.restaurantId ?? null,
      details: { username: user.username, role: user.role, restaurantId: user.restaurantId ?? null, ...(roleId ? { roleId } : {}) },
    });
    return user;
  }
}
