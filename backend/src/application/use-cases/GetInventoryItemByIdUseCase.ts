import { InventoryRepository } from '../../domain/ports/out/InventoryRepository.js';
import { Inventory } from '../../domain/models/Inventory.js';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/DomainErrors.js';

export class GetInventoryItemByIdUseCase {
  constructor(private inventoryRepo: InventoryRepository) {}

  async execute(id: string, restaurantId: string): Promise<Inventory> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant ID is required to fetch inventory item.');
    }
    const item = await this.inventoryRepo.findById(id, restaurantId);
    if (!item) {
      throw new EntityNotFoundError(`Inventory item '${id}' not found for restaurant '${restaurantId}'.`);
    }
    return item;
  }
}
