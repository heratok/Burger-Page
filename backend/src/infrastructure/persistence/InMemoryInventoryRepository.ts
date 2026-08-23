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

  async findById(id: string): Promise<Inventory | null> {
    return this.inventoryMap.get(id) || null;
  }

  async findAll(): Promise<Inventory[]> {
    return Array.from(this.inventoryMap.values());
  }

  async save(inventory: Inventory): Promise<void> {
    this.inventoryMap.set(inventory.id, { ...inventory });
  }
}
