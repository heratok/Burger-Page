import { RestaurantTable } from '../../models/RestaurantTable.js';

export interface RestaurantTableRepository {
  /** Ordered by sortOrder, then name. */
  findByRestaurantId(restaurantId: string): Promise<RestaurantTable[]>;
  findById(id: string, restaurantId: string): Promise<RestaurantTable | null>;
  /**
   * Inserts or updates by id. A name already used (case-insensitively) by
   * another table of the same restaurant throws ConflictError.
   */
  save(table: RestaurantTable): Promise<void>;
  /** Deleting a table keeps the orders that referenced it (their label stays). */
  delete(id: string, restaurantId: string): Promise<void>;
}
