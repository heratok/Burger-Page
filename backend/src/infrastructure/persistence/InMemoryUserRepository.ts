import { User } from '../../domain/models/User.js';
import { UserRepository } from '../../domain/ports/out/UserRepository.js';

export class InMemoryUserRepository implements UserRepository {
  private users = new Map<string, User>();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findByUsername(username: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.username === username) return user;
    }
    return null;
  }

  async findByRestaurantId(restaurantId: string): Promise<User[]> {
    return [...this.users.values()].filter(
      (u) => u.restaurantId === restaurantId
    );
  }

  async findAll(): Promise<User[]> {
    return [...this.users.values()];
  }

  async save(user: User): Promise<void> {
    this.users.set(user.id, user);
  }

  async delete(id: string): Promise<void> {
    this.users.delete(id);
  }
}
