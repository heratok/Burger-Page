import { ID_PREFIX, newId } from '../../domain/shared/newId.js';
import { UserRepository } from '../../domain/ports/out/UserRepository.js';
import { PasswordHasher } from '../../domain/ports/out/PasswordHasher.js';
import { RestaurantRepository } from '../../domain/ports/out/RestaurantRepository.js';
import { ValidationError, EntityNotFoundError } from '../../domain/errors/DomainErrors.js';
import { User, UserRole, MIN_PASSWORD_LENGTH } from '../../domain/models/User.js';
import { CreateUserDTO } from '../dtos/index.js';
import { AdminAuditRecorder, AuditActor } from '../services/AdminAuditRecorder.js';

export class CreateUserUseCase {
  constructor(
    private userRepo: UserRepository,
    private hasher: PasswordHasher,
    private restaurantRepo: RestaurantRepository,
    private audit?: AdminAuditRecorder
  ) {}

  async execute(dto: CreateUserDTO, callerRole?: UserRole, actor?: AuditActor): Promise<User> {
    const username = dto.username.trim();
    if (!username) {
      throw new ValidationError('Username is required');
    }

    if (dto.password.length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    if (dto.role === 'restaurant_admin') {
      if (!dto.restaurantId) {
        throw new ValidationError('restaurantId is required for restaurant_admin role');
      }
      const restaurant = await this.restaurantRepo.findById(dto.restaurantId);
      if (!restaurant || restaurant.isActive === false) {
        throw new EntityNotFoundError(`Restaurant '${dto.restaurantId}' not found or inactive`);
      }
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
      restaurantId: dto.role === 'restaurant_admin' ? dto.restaurantId : undefined,
      createdAt: new Date().toISOString(),
      // The super admin chose this password, so the account owner must replace it at first login.
      mustChangePassword: true,
    };

    await this.userRepo.save(user, callerRole);
    await this.audit?.record(actor, {
      action: 'user.create',
      targetType: 'user',
      targetId: user.id,
      targetLabel: user.username,
      restaurantId: user.restaurantId ?? null,
      details: { username: user.username, role: user.role, restaurantId: user.restaurantId ?? null },
    });
    return user;
  }
}
