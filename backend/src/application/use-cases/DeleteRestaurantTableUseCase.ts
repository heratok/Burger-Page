import { RestaurantTableRepository } from '../../domain/ports/out/RestaurantTableRepository.js';
import { EntityNotFoundError } from '../../domain/errors/DomainErrors.js';

export class DeleteRestaurantTableUseCase {
  constructor(private tableRepo: RestaurantTableRepository) {}

  /** Orders that used the table keep their table_label snapshot. */
  async execute(id: string, restaurantId: string): Promise<void> {
    const existing = await this.tableRepo.findById(id, restaurantId);
    if (!existing) {
      throw new EntityNotFoundError(`Table "${id}" not found`);
    }
    await this.tableRepo.delete(id, restaurantId);
  }
}
