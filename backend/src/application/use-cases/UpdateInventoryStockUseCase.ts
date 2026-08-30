import { InventoryRepository } from '../../domain/ports/out/InventoryRepository.js';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/DomainErrors.js';
import { Inventory } from '../../domain/models/Inventory.js';

export class UpdateInventoryStockUseCase {
  constructor(private inventoryRepo: InventoryRepository) {}

  async execute(id: string, quantityChange: number, restaurantId: string): Promise<Inventory> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant ID is required to adjust inventory stock.');
    }
    if (quantityChange === undefined || isNaN(Number(quantityChange))) {
      throw new ValidationError('Quantity change must be a valid number.');
    }

    const delta = Number(quantityChange);
    const item = await this.inventoryRepo.findById(id, restaurantId);
    if (!item) {
      throw new EntityNotFoundError(`Inventory item '${id}' not found for restaurant '${restaurantId}'.`);
    }

    const newQuantity = Number((item.quantity + delta).toFixed(2));
    if (newQuantity < 0) {
      throw new ValidationError(`Insufficient stock. Current stock is ${item.quantity}, cannot reduce by ${Math.abs(delta)}.`);
    }

    item.quantity = newQuantity;
    item.updatedAt = new Date().toISOString();
    await this.inventoryRepo.save(item);
    return item;
  }
}
