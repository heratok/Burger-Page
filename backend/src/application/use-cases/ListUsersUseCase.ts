import { UserRepository } from '../../domain/ports/out/UserRepository.js';
import { UserRole } from '../../domain/models/User.js';

export interface SafeUser {
  id: string;
  username: string;
  role: 'super_admin' | 'restaurant_admin';
  restaurantId?: string;
  createdAt: string;
}

export class ListUsersUseCase {
  constructor(private userRepo: UserRepository) {}

  async execute(restaurantId?: string, callerRole?: UserRole): Promise<SafeUser[]> {
    const users = restaurantId
      ? await this.userRepo.findByRestaurantId(restaurantId)
      : await this.userRepo.findAll(callerRole);

    return users.map(({ passwordHash: _, ...safe }) => safe);
  }
}
