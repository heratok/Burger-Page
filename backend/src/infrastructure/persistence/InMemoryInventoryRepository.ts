import { InventoryRepository } from '../../domain/ports/out/InventoryRepository.js';
import { Inventory } from '../../domain/models/Inventory.js';
import { initialInventory } from './seedData.js';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/DomainErrors.js';

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

  async adjustStock(id: string, restaurantId: string, delta: number): Promise<Inventory> {
    const item = this.inventoryMap.get(id);
    if (!item || item.restaurantId !== restaurantId) {
      throw new EntityNotFoundError(`Inventory item '${id}' not found for restaurant '${restaurantId}'.`);
    }
    if (delta < 0 && item.quantity < Math.abs(delta)) {
      throw new ValidationError(
        `Insufficient stock for item '${item.name}'. Current stock is ${item.quantity}, cannot reduce by ${Math.abs(delta)}.`
      );
    }
    const newQuantity = Number((item.quantity + delta).toFixed(2));
    const updated: Inventory = { ...item, quantity: newQuantity, updatedAt: new Date().toISOString() };
    this.inventoryMap.set(id, updated);
    return { ...updated };
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
