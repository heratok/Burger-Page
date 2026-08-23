import { InventoryRepository } from '../../domain/ports/out/InventoryRepository.js';
import { EntityNotFoundError } from '../../domain/errors/DomainErrors.js';

export class UpdateInventoryStockUseCase {
  constructor(private inventoryRepo: InventoryRepository) {}

  async execute(id: string, quantityChange: number): Promise<void> {
    const item = await this.inventoryRepo.findById(id);
    if (!item) throw new EntityNotFoundError('Inventory item not found');

    item.quantity += quantityChange;
    await this.inventoryRepo.save(item);
  }
}
