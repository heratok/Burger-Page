import { Inventory } from '../../models/Inventory.js';
import { ListOptions } from './ListOptions.js';

export interface InventoryRepository {
  findById(id: string, restaurantId: string): Promise<Inventory | null>;
  findByRestaurantId(restaurantId: string, options?: ListOptions): Promise<Inventory[]>;
  /** Tenant-scoped total count for pagination (optional so test fakes may omit it). */
  countByRestaurantId?(restaurantId: string): Promise<number>;
  save(inventory: Inventory): Promise<void>;
  adjustStock(id: string, restaurantId: string, delta: number): Promise<Inventory>;
  delete(id: string, restaurantId: string): Promise<void>;
}
