import { User } from '../../domain/models/User.js';
import {
  UserRepository,
  GuardedUserChange,
  UserChanges,
  UserUpdateOutcome,
  RestoredUser,
} from '../../domain/ports/out/UserRepository.js';
import { initialUsers } from './seedData.js';
import { computeRemovesSuperAdminAccess, wouldStripLastActiveSuperAdmin } from '../../domain/shared/superAdminGuard.js';

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
  private hasOtherActiveSuperAdmin(excludeId: string): boolean {
    return [...this.users.values()].some(
      (u) => u.id !== excludeId && u.role === 'super_admin' && u.isActive !== false
    );
  }

  async setActive(id: string, isActive: boolean): Promise<GuardedUserChange> {
    const target = this.users.get(id);
    if (!target) return 'not_found';
    const removesAccess = !isActive;
    if (
      wouldStripLastActiveSuperAdmin(
        { role: target.role, isActive: target.isActive !== false },
        removesAccess,
        this.hasOtherActiveSuperAdmin(id)
      )
    ) {
      return 'last_super_admin';
    }
    this.users.set(id, { ...target, isActive });
    return 'done';
  }

  async deleteGuarded(id: string): Promise<GuardedUserChange> {
    const target = this.users.get(id);
    if (!target) return 'not_found';
    if (
      wouldStripLastActiveSuperAdmin(
        { role: target.role, isActive: target.isActive !== false },
        true,
        this.hasOtherActiveSuperAdmin(id)
      )
    ) {
      return 'last_super_admin';
    }
    this.users.delete(id);
    return 'done';
  }

  /** is_active a retired user had before its tenant was deleted (users.retired_was_active). */
  private retiredWasActive = new Map<string, boolean>();

  async retireByRestaurantId(restaurantId: string): Promise<void> {
    const suffix = `-deleted-${restaurantId}`;
    for (const [id, user] of [...this.users.entries()]) {
      if (user.restaurantId !== restaurantId) continue;
      const alreadyRetired = user.username.endsWith(suffix);
      // Idempotent: a second retire must not capture the already-retired state.
      if (!alreadyRetired) this.retiredWasActive.set(id, user.isActive !== false);
      const username = alreadyRetired ? user.username : user.username + suffix;
      this.users.set(id, { ...user, isActive: false, username });
    }
  }

  async updateGuarded(id: string, changes: UserChanges): Promise<UserUpdateOutcome> {
    const target = this.users.get(id);
    if (!target) return 'not_found';
    if (changes.username !== undefined) {
      for (const other of this.users.values()) {
        if (other.id !== id && other.username === changes.username) return 'username_taken';
      }
    }
    const next: User = { ...target };
    if (changes.username !== undefined) next.username = changes.username;
    if (changes.role !== undefined) next.role = changes.role;
    if (changes.restaurantId !== undefined) next.restaurantId = changes.restaurantId ?? undefined;
    if (changes.roleId !== undefined) next.roleId = changes.roleId ?? undefined;
    if (changes.isActive !== undefined) next.isActive = changes.isActive;
    const removesAccess = computeRemovesSuperAdminAccess(next.role, next.isActive !== false);
    if (
      wouldStripLastActiveSuperAdmin(
        { role: target.role, isActive: target.isActive !== false },
        removesAccess,
        this.hasOtherActiveSuperAdmin(id)
      )
    ) {
      return 'last_super_admin';
    }
    this.users.set(id, next);
    return 'done';
  }

  async restoreByRestaurantId(restaurantId: string): Promise<RestoredUser[]> {
    const suffix = `-deleted-${restaurantId}`;
    const restored: RestoredUser[] = [];
    for (const [id, user] of [...this.users.entries()]) {
      if (user.restaurantId !== restaurantId || !user.username.endsWith(suffix)) continue;
      const originalUsername = user.username.slice(0, -suffix.length);
      const taken = [...this.users.values()].some((u) => u.id !== id && u.username === originalUsername);
      const username = taken ? `${originalUsername}-restored-${restaurantId}` : originalUsername;
      // Unknown prior state (retired before it was tracked) restores active.
      const isActive = this.retiredWasActive.get(id) ?? true;
      this.retiredWasActive.delete(id);
      this.users.set(id, { ...user, isActive, username });
      restored.push({ id, username, originalUsername });
    }
    return restored;
  }
}
