import { UserRepository } from '../../domain/ports/out/UserRepository.js';
import { PasswordHasher } from '../../domain/ports/out/PasswordHasher.js';
import { UnauthorizedError } from '../../domain/errors/DomainErrors.js';
import { AuthResult } from '../dtos/index.js';

export class AuthenticateUserUseCase {
  constructor(
    private userRepo: UserRepository,
    private hasher: PasswordHasher
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

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        restaurantId: user.restaurantId,
      },
    };
  }
}
