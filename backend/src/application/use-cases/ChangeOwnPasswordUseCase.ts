import { UserRepository } from '../../domain/ports/out/UserRepository.js';
import { PasswordHasher } from '../../domain/ports/out/PasswordHasher.js';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/DomainErrors.js';
import { MIN_PASSWORD_LENGTH } from '../../domain/models/User.js';
import { JwtService } from '../../infrastructure/security/JwtService.js';

export interface ChangeOwnPasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

export class ChangeOwnPasswordUseCase {
  constructor(
    private userRepo: UserRepository,
    private hasher: PasswordHasher,
    private jwtService: JwtService = new JwtService()
  ) {}

  /** Returns a fresh session token: the previous one may still carry the must-change claim. */
  async execute({ userId, currentPassword, newPassword }: ChangeOwnPasswordInput): Promise<{ token: string }> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new EntityNotFoundError('Account not found');
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    // A wrong current password is a 400, not a 401: the session itself is valid
    // and clients treat 401 as "signed out".
    if (!(await this.hasher.verify(currentPassword, user.passwordHash))) {
      throw new ValidationError('Current password is incorrect');
    }
    if (newPassword === currentPassword) {
      throw new ValidationError('New password must be different from the current one');
    }

    const passwordHash = await this.hasher.hash(newPassword);
    await this.userRepo.save({ ...user, passwordHash, mustChangePassword: false, passwordChangedAt: new Date().toISOString() }, user.role);

    return {
      token: this.jwtService.generateToken({
        id: user.id,
        username: user.username,
        role: user.role,
        restaurantId: user.restaurantId,
      }),
    };
  }
}
