import { randomUUID } from 'node:crypto';
import { UserRepository } from '../../domain/ports/out/UserRepository.js';
import { PasswordHasher } from '../../domain/ports/out/PasswordHasher.js';
import { ValidationError } from '../../domain/errors/DomainErrors.js';
import { User } from '../../domain/models/User.js';
import { CreateUserDTO } from '../dtos/index.js';

export class CreateUserUseCase {
  constructor(
    private userRepo: UserRepository,
    private hasher: PasswordHasher
  ) {}

  async execute(dto: CreateUserDTO): Promise<User> {
    const username = dto.username.trim();
    if (!username) {
      throw new ValidationError('Username is required');
    }

    if (dto.password.length < 6) {
      throw new ValidationError('Password must be at least 6 characters');
    }

    if (dto.role === 'restaurant_admin' && !dto.restaurantId) {
      throw new ValidationError('restaurantId is required for restaurant_admin role');
    }

    const existing = await this.userRepo.findByUsername(username);
    if (existing) {
      throw new ValidationError(`Username "${username}" already exists`);
    }

    const passwordHash = await this.hasher.hash(dto.password);

    const user: User = {
      id: randomUUID(),
      username,
      passwordHash,
      role: dto.role,
      restaurantId: dto.role === 'restaurant_admin' ? dto.restaurantId : undefined,
      createdAt: new Date().toISOString(),
    };

    await this.userRepo.save(user);
    return user;
  }
}
