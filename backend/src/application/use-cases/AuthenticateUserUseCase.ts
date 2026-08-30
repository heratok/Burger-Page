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
    const user = await this.userRepo.findByUsername(username);
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
