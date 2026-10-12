import { RestaurantTable } from '../../models/RestaurantTable.js';

export interface RestaurantTableRepository {
  /** Ordered by sortOrder, then lower(zone), then number. */
  findByRestaurantId(restaurantId: string): Promise<RestaurantTable[]>;
  findById(id: string, restaurantId: string): Promise<RestaurantTable | null>;
  /**
   * Inserts or updates by id. A (zone, number) already used (zone compared
   * case-insensitively) by another table of the same restaurant throws ConflictError.
   */
  save(table: RestaurantTable): Promise<void>;
  /**
   * Inserts new tables atomically: all or none. Any (zone, number) conflict,
   * including a concurrent one, throws ConflictError and leaves nothing behind.
   */
  saveMany(tables: RestaurantTable[]): Promise<void>;
  /** Deleting a table keeps the orders that referenced it (their label stays). */
  delete(id: string, restaurantId: string): Promise<void>;
}
