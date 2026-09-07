import { UserRepository } from '../../domain/ports/out/UserRepository.js';
import { PasswordHasher } from '../../domain/ports/out/PasswordHasher.js';
import { UnauthorizedError } from '../../domain/errors/DomainErrors.js';
import { AuthResult } from '../dtos/index.js';
import { JwtService } from '../../infrastructure/security/JwtService.js';

export class AuthenticateUserUseCase {
  constructor(
    private userRepo: UserRepository,
    private hasher: PasswordHasher,
    private jwtService: JwtService = new JwtService()
  ) {}

  async execute(username: string, password: string): Promise<AuthResult> {
    let user = await this.userRepo.findByUsername(username);

    // Fallback: support login without admin_ prefix (e.g. rosto -> admin_rosto)
    if (!user && !username.startsWith('admin_')) {
      user = await this.userRepo.findByUsername(`admin_${username}`);
    }

    // Fallback: support login using restaurantId / slug identifier
    if (!user && typeof this.userRepo.findByRestaurantId === 'function') {
      const usersByRest = (await this.userRepo.findByRestaurantId(username)) || [];
      const adminUser = usersByRest.find((u) => u.role === 'restaurant_admin');
      if (adminUser) {
        user = adminUser;
      }
    }

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
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
    });

    return {
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        restaurantId: user.restaurantId,
      },
    };
  }
}
