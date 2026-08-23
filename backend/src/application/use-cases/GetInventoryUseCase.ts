import { InventoryRepository } from '../../domain/ports/out/InventoryRepository.js';
import { Inventory } from '../../domain/models/Inventory.js';

export class GetInventoryUseCase {
  constructor(private inventoryRepo: InventoryRepository) {}

  async execute(): Promise<Inventory[]> {
    return this.inventoryRepo.findAll();
  }
}
