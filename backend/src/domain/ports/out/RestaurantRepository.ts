import { DeletedRestaurant, Restaurant } from '../../models/Restaurant.js';

/** Outcome of restoring a deleted tenant; the slug check and the write are atomic. */
export type RestoreRestaurantOutcome = 'restored' | 'not_found' | 'slug_taken';

export interface RestaurantRepository {
  findById(id: string): Promise<Restaurant | null>;
  findBySlug(slug: string): Promise<Restaurant | null>;
  findAll(): Promise<Restaurant[]>;
  save(restaurant: Restaurant): Promise<void>;
  delete(id: string): Promise<void>;
  hardDelete?(id: string): Promise<void>;
  /** Soft-deleted tenants (newest deletion first) with their original slug. */
  findDeleted(): Promise<DeletedRestaurant[]>;
  /**
   * Undoes a soft delete: clears deleted_at, stores `slug`, and leaves the
   * tenant PAUSED (is_active=false) so it is reactivated explicitly. Refuses
   * with 'slug_taken' when a live tenant owns `slug`.
   */
  restore(id: string, slug: string): Promise<RestoreRestaurantOutcome>;
}
