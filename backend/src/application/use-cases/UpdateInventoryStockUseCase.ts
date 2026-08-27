import { InventoryRepository } from '../../domain/ports/out/InventoryRepository.js';
import { EntityNotFoundError } from '../../domain/errors/DomainErrors.js';
import { Inventory } from '../../domain/models/Inventory.js';

export class UpdateInventoryStockUseCase {
  constructor(private inventoryRepo: InventoryRepository) {}

  async execute(id: string, quantityChange: number): Promise<Inventory> {
    const item = await this.inventoryRepo.findById(id);
    if (!item) throw new EntityNotFoundError('Inventory item not found');

    item.quantity += quantityChange;
    await this.inventoryRepo.save(item);
    return item;
  }
}
