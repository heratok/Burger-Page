import { RestaurantRepository } from '../../domain/ports/out/RestaurantRepository.js';
import { EntityNotFoundError } from '../../domain/errors/DomainErrors.js';

export class DeleteRestaurantUseCase {
  constructor(private restaurantRepo: RestaurantRepository) {}

  async execute(id: string): Promise<void> {
    const existing = await this.restaurantRepo.findById(id);
    if (!existing) {
      const bySlug = await this.restaurantRepo.findBySlug(id);
      if (!bySlug) {
        throw new EntityNotFoundError(`Restaurant with id or slug "${id}" not found`);
      }
      await this.restaurantRepo.delete(bySlug.id);
      return;
    }
    await this.restaurantRepo.delete(id);
  }
}
