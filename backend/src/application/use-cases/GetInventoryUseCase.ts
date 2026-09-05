import { InventoryRepository } from '../../domain/ports/out/InventoryRepository.js';
import { Inventory } from '../../domain/models/Inventory.js';
import { ValidationError } from '../../domain/errors/DomainErrors.js';

export class GetInventoryUseCase {
  constructor(private inventoryRepo: InventoryRepository) {}

  async execute(restaurantId: string): Promise<Inventory[]> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant ID is required to list inventory.');
    }
    return this.inventoryRepo.findByRestaurantId(restaurantId);
  }
}
