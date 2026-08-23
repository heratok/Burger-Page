import { Inventory } from '../../models/Inventory.js';

export interface InventoryRepository {
  findById(id: string): Promise<Inventory | null>;
  findAll(): Promise<Inventory[]>;
  save(inventory: Inventory): Promise<void>;
}
