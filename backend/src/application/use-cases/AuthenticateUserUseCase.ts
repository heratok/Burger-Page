import { RestaurantRepository } from '../../domain/ports/out/RestaurantRepository.js';
import { UserRepository } from '../../domain/ports/out/UserRepository.js';
import { PasswordHasher } from '../../domain/ports/out/PasswordHasher.js';
import { RoleRepository } from '../../domain/ports/out/RoleRepository.js';
import { resolvePermissions } from '@burger-page/contracts';
import { UnauthorizedError } from '../../domain/errors/DomainErrors.js';
import { AuthResult } from '../dtos/index.js';
import { JwtService } from '../../infrastructure/security/JwtService.js';

export class AuthenticateUserUseCase {
  constructor(
    private userRepo: UserRepository,
    private hasher: PasswordHasher,
    private jwtService: JwtService = new JwtService(),
    private restaurantRepo?: RestaurantRepository,
    private roleRepo?: RoleRepository
  ) {}

  async execute(username: string, password: string): Promise<AuthResult> {
    let user = await this.userRepo.findByUsername(username);

    // Fallback: support login without admin_ prefix (e.g. craft -> admin_craft)
    if (!user && !username.startsWith('admin_')) {
      user = await this.userRepo.findByUsername(`admin_${username}`);
    }

    // Fallback: support login using restaurantId / slug identifier (with or without rest- prefix)
    if (!user && typeof this.userRepo.findByRestaurantId === 'function') {
      const candidates = [
        username,
        username.replace(/^rest-/, ''),
        `rest-${username}`,
      ];
      for (const candidate of candidates) {
        const usersByRest = (await this.userRepo.findByRestaurantId(candidate)) || [];
        const adminUser = usersByRest.find((u) => u.role === 'restaurant_admin');
        if (adminUser) {
          user = adminUser;
          break;
        }
      }
    }

    if (!user) {
          throw new UnauthorizedError('Invalid credentials');
        }

        if (user.isActive === false) {
          throw new UnauthorizedError('Invalid credentials');
        }

        // A tenant admin of a paused or deleted restaurant must not get a token
        // that every later call would reject; the answer stays the generic
        // credentials error so it never confirms the password was right.
        if (this.restaurantRepo && user.restaurantId) {
          const restaurant = await this.restaurantRepo.findById(user.restaurantId);
          if (!restaurant || !restaurant.isActive) {
            throw new UnauthorizedError('Invalid credentials');
          }
        }

        const valid = await this.hasher.verify(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const token = this.jwtService.generateToken({
      id: user.id,
      username: user.username,
      role: user.role,
      restaurantId: user.restaurantId,
      mustChangePassword: user.mustChangePassword === true,
    });

    // Staff permissions come from the stored role of their own restaurant;
    // an unresolvable role means no permissions (fail closed).
    const storedRole =
      user.role === 'restaurant_staff' && this.roleRepo && user.roleId && user.restaurantId
        ? await this.roleRepo.findById(user.roleId, user.restaurantId)
        : null;
    const permissions = resolvePermissions({ role: user.role, rolePermissions: storedRole?.permissions });

    return {
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        restaurantId: user.restaurantId,
        roleId: user.roleId,
        permissions,
        mustChangePassword: user.mustChangePassword === true,
      },
    };
  }
}
