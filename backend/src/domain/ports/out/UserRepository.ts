import { User, UserRole } from '../../models/User.js';

/**
 * Outcome of a change that must never leave the platform without an active
 * super admin. The check and the write happen atomically in the repository.
 */
export type GuardedUserChange = 'done' | 'not_found' | 'last_super_admin';

/** Fields a super admin may edit on an existing user (never the password). */
export interface UserChanges {
  username?: string;
  role?: UserRole;
  /** null clears it (super_admin). The use case validates the combination. */
  restaurantId?: string | null;
  isActive?: boolean;
}

export type UserUpdateOutcome = GuardedUserChange | 'username_taken';

/** A user brought back by a tenant restore; `originalUsername` differs from `username` when the original was taken meanwhile. */
export interface RestoredUser {
  id: string;
  username: string;
  originalUsername: string;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findByRestaurantId(restaurantId: string): Promise<User[]>;
  findAll(actorRole?: UserRole): Promise<User[]>;
  save(user: User, actorRole?: UserRole): Promise<void>;
  delete(id: string, actorRole?: UserRole): Promise<void>;
  /**
   * Updates only is_active (never the hash or other fields). Deactivating an
   * active super admin is refused with 'last_super_admin' when no other active
   * super admin would remain; the check and write are atomic.
   */
  setActive(id: string, isActive: boolean): Promise<GuardedUserChange>;
  /** Deletes a user, refusing to remove the last active super admin (atomic). */
  deleteGuarded(id: string): Promise<GuardedUserChange>;
  /**
   * Called when a tenant is deleted: deactivates all of its users and renames
   * their usernames with a `-deleted-<restaurantId>` suffix so the usernames
   * (e.g. the default `admin_<slug>`) can be reused. Idempotent.
   */
  retireByRestaurantId(restaurantId: string): Promise<void>;
  /**
   * Atomic, guarded edit of an existing user. Refused with 'last_super_admin'
   * when the change would leave the platform without an active super admin
   * (demotion or deactivation) and 'username_taken' when another user owns the
   * username. Only the given fields change.
   */
  updateGuarded(id: string, changes: UserChanges): Promise<UserUpdateOutcome>;
  /**
   * Reverse of retireByRestaurantId: reactivates the tenant's retired users and
   * strips the `-deleted-<restaurantId>` suffix. When the original username is
   * now owned by someone else the user gets `<original>-restored-<restaurantId>`
   * instead. All-or-nothing; returns the restored users. Idempotent.
   */
  restoreByRestaurantId(restaurantId: string): Promise<RestoredUser[]>;
}
