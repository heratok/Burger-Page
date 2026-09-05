import { InventoryRepository } from '../../domain/ports/out/InventoryRepository.js';
import { ValidationError } from '../../domain/errors/DomainErrors.js';
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

    // Delegates atomicity to the repository layer to avoid race conditions
    return await this.inventoryRepo.adjustStock(id, restaurantId, Number(quantityChange));
  }
}
