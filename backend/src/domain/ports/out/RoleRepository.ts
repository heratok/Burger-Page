import { Role } from '../../models/Role.js';

export interface RoleRepository {
  /** Ordered by name (case-insensitive). */
  findByRestaurantId(restaurantId: string): Promise<Role[]>;
  findById(id: string, restaurantId: string): Promise<Role | null>;
  /**
   * Inserts or updates by id. A name already used (case-insensitively, ignoring
   * surrounding spaces) by another role of the same restaurant throws ConflictError.
   */
  save(role: Role): Promise<void>;
  /**
   * Removes a role of the restaurant. A role that users still hold is refused
   * with ConflictError (the database enforces it with a foreign key).
   */
  delete(id: string, restaurantId: string): Promise<void>;
}
