import { InventoryRepository } from '../../domain/ports/out/InventoryRepository.js';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/DomainErrors.js';

export class DeleteInventoryItemUseCase {
  constructor(private inventoryRepo: InventoryRepository) {}

  async execute(id: string, restaurantId: string): Promise<void> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant ID is required to delete an inventory item.');
    }
    const item = await this.inventoryRepo.findById(id, restaurantId);
    if (!item) {
      throw new EntityNotFoundError(`Inventory item '${id}' not found for restaurant '${restaurantId}'.`);
    }
    await this.inventoryRepo.delete(id, restaurantId);
  }
}
