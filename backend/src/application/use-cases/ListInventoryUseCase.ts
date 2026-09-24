import { InventoryRepository } from '../../domain/ports/out/InventoryRepository.js';
import { Inventory } from '../../domain/models/Inventory.js';
import { ValidationError } from '../../domain/errors/DomainErrors.js';
import { ListOptions, PaginatedResult } from '../../domain/ports/out/ListOptions.js';

export class ListInventoryUseCase {
  constructor(private inventoryRepo: InventoryRepository) {}

  async execute(restaurantId: string): Promise<Inventory[]>;
  async execute(restaurantId: string, options: ListOptions): Promise<PaginatedResult<Inventory>>;
  async execute(restaurantId: string, options?: ListOptions): Promise<Inventory[] | PaginatedResult<Inventory>> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant ID is required to list inventory.');
    }

    if (options?.limit !== undefined) {
      const [items, total] = await Promise.all([
        this.inventoryRepo.findByRestaurantId(restaurantId, options),
        this.inventoryRepo.countByRestaurantId?.(restaurantId),
      ]);
      return { items, total: total ?? items.length };
    }

    return this.inventoryRepo.findByRestaurantId(restaurantId);
  }
}