import { User } from '../../domain/models/User.js';
import { UserRepository, GuardedUserChange } from '../../domain/ports/out/UserRepository.js';
import { initialUsers } from './seedData.js';

export class InMemoryUserRepository implements UserRepository {
  private users = new Map<string, User>();

  constructor() {
    for (const u of initialUsers) {
      this.users.set(u.id, { ...u });
    }
  }

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
  // The in-memory repo is single-threaded and these methods contain no await,
  // so check + write is atomic, matching the Postgres row-lock semantics.
  private isLastActiveSuperAdmin(target: User): boolean {
    if (target.role !== 'super_admin' || target.isActive === false) return false;
    return ![...this.users.values()].some(
      (u) => u.id !== target.id && u.role === 'super_admin' && u.isActive !== false
    );
  }

  async setActive(id: string, isActive: boolean): Promise<GuardedUserChange> {
    const target = this.users.get(id);
    if (!target) return 'not_found';
    if (!isActive && this.isLastActiveSuperAdmin(target)) return 'last_super_admin';
    this.users.set(id, { ...target, isActive });
    return 'done';
  }

  async deleteGuarded(id: string): Promise<GuardedUserChange> {
    const target = this.users.get(id);
    if (!target) return 'not_found';
    if (this.isLastActiveSuperAdmin(target)) return 'last_super_admin';
    this.users.delete(id);
    return 'done';
  }

  async retireByRestaurantId(restaurantId: string): Promise<void> {
    const suffix = `-deleted-${restaurantId}`;
    for (const [id, user] of [...this.users.entries()]) {
      if (user.restaurantId !== restaurantId) continue;
      const username = user.username.endsWith(suffix) ? user.username : user.username + suffix;
      this.users.set(id, { ...user, isActive: false, username });
    }
  }
}
