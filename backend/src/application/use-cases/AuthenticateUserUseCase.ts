import { RestaurantRepository } from '../../domain/ports/out/RestaurantRepository.js';
import { UserRepository } from '../../domain/ports/out/UserRepository.js';
import { PasswordHasher } from '../../domain/ports/out/PasswordHasher.js';
import { RoleRepository } from '../../domain/ports/out/RoleRepository.js';
import { resolvePermissions } from '@burger-page/contracts';
import { TooManyRequestsError, UnauthorizedError } from '../../domain/errors/DomainErrors.js';
import { LoginThrottle } from '../services/LoginThrottle.js';
import type { User } from '../../domain/models/User.js';
import { AuthResult } from '../dtos/index.js';
import { JwtService } from '../../infrastructure/security/JwtService.js';

export class AuthenticateUserUseCase {
  constructor(
    private userRepo: UserRepository,
    private hasher: PasswordHasher,
    private jwtService: JwtService = new JwtService(),
    private restaurantRepo?: RestaurantRepository,
    private roleRepo?: RoleRepository,
    private throttle: LoginThrottle = new LoginThrottle()
  ) {}

  /** Hash of a throwaway password, verified on every failed lookup (lazy, computed once). */
  private dummyHash?: Promise<string>;

  async execute(username: string, password: string): Promise<AuthResult> {
    // Keyed on the typed login AND on the resolved account, so cycling the
    // login aliases of one account (slug, admin_<slug>, ...) shares its lock.
    const loginKey = `login:${String(username ?? '').trim().toLowerCase()}`;
    this.assertNotLocked(loginKey);

    const user = await this.resolveUser(username);
    const accountKey = user ? `account:${user.id}` : undefined;
    const keys = accountKey ? [loginKey, accountKey] : [loginKey];
    this.assertNotLocked(...keys);

    if (!user || !(await this.isLoginAllowed(user))) {
      // Same work as a real check, so the response time does not reveal
      // whether the account exists or is enabled.
      this.dummyHash ??= this.hasher.hash('timing-equalizer-not-a-password');
      await this.hasher.verify(password, (await this.dummyHash) ?? '');
      this.throttle.recordFailure(...keys);
      throw new UnauthorizedError('Invalid credentials');
    }

    const valid = await this.hasher.verify(password, user.passwordHash);
    if (!valid) {
      this.throttle.recordFailure(...keys);
      throw new UnauthorizedError('Invalid credentials');
    }
    this.throttle.reset(...keys);

    return this.issueSession(user);
  }

  private assertNotLocked(...keys: string[]): void {
    const retryAfter = this.throttle.lockedFor(...keys);
    if (retryAfter > 0) {
      throw new TooManyRequestsError(
        'Demasiados intentos fallidos. Esperá unos minutos antes de volver a intentar.',
        retryAfter
      );
    }
  }

  /**
   * An inactive account, or a tenant admin of a paused or deleted restaurant,
   * must not get a token that every later call would reject; the answer stays
   * the generic credentials error so it never confirms the password was right.
   */
  private async isLoginAllowed(user: User): Promise<boolean> {
    if (user.isActive === false) return false;
    if (this.restaurantRepo && user.restaurantId) {
      const restaurant = await this.restaurantRepo.findById(user.restaurantId);
      if (!restaurant || !restaurant.isActive) return false;
    }
    return true;
  }

  private async resolveUser(username: string): Promise<User | null> {
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

    return user ?? null;
  }

  private async issueSession(user: User): Promise<AuthResult> {
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
