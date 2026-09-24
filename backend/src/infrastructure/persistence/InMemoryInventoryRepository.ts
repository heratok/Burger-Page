import { InventoryRepository } from '../../domain/ports/out/InventoryRepository.js';
import { Inventory } from '../../domain/models/Inventory.js';
import { ListOptions } from '../../domain/ports/out/ListOptions.js';
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

  async findByRestaurantId(restaurantId: string, options?: ListOptions): Promise<Inventory[]> {
    const filtered = Array.from(this.inventoryMap.values()).filter((item) => item.restaurantId === restaurantId);
    const limit = options?.limit;
    if (typeof limit === 'number' && Number.isInteger(limit) && limit > 0) {
      const page = options?.page && Number.isInteger(options.page) && options.page >= 1 ? options.page : 1;
      const start = (page - 1) * limit;
      return filtered.slice(start, start + limit).map((item) => ({ ...item }));
    }
    return filtered.map((item) => ({ ...item }));
  }

  async countByRestaurantId(restaurantId: string): Promise<number> {
    return Array.from(this.inventoryMap.values()).filter((item) => item.restaurantId === restaurantId).length;
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
