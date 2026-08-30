import { Inventory } from '../../models/Inventory.js';

export interface InventoryRepository {
  findById(id: string, restaurantId: string): Promise<Inventory | null>;
  findByRestaurantId(restaurantId: string): Promise<Inventory[]>;
  save(inventory: Inventory): Promise<void>;
  delete(id: string, restaurantId: string): Promise<void>;
}
