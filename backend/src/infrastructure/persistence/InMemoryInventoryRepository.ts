import { InventoryRepository } from '../../domain/ports/out/InventoryRepository.js';
import { Inventory } from '../../domain/models/Inventory.js';
import { initialInventory } from './seedData.js';

export class InMemoryInventoryRepository implements InventoryRepository {
  private inventoryMap: Map<string, Inventory> = new Map();

  constructor() {
    for (const i of initialInventory) {
      this.inventoryMap.set(i.id, { ...i });
    }
  }

  async findById(id: string, restaurantId: string): Promise<Inventory | null> {
    const item = this.inventoryMap.get(id);
    if (!item) return null;
    if (item.restaurantId !== restaurantId) return null;
    return { ...item };
  }

  async findByRestaurantId(restaurantId: string): Promise<Inventory[]> {
    return Array.from(this.inventoryMap.values())
      .filter((item) => item.restaurantId === restaurantId)
      .map((item) => ({ ...item }));
  }

  async save(inventory: Inventory): Promise<void> {
    this.inventoryMap.set(inventory.id, { ...inventory });
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    const item = this.inventoryMap.get(id);
    if (item && item.restaurantId === restaurantId) {
      this.inventoryMap.delete(id);
    }
  }

  clear(): void {
    this.inventoryMap.clear();
  }
}
