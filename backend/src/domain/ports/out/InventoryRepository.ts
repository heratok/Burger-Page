import { Inventory } from '../../models/Inventory.js';

export interface InventoryRepository {
  findById(id: string, restaurantId: string): Promise<Inventory | null>;
  findByRestaurantId(restaurantId: string): Promise<Inventory[]>;
  save(inventory: Inventory): Promise<void>;
  adjustStock(id: string, restaurantId: string, delta: number): Promise<Inventory>;
  delete(id: string, restaurantId: string): Promise<void>;
}
