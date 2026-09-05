import { RestaurantRepository } from '../../domain/ports/out/RestaurantRepository.js';
import { CategoryRepository } from '../../domain/ports/out/CategoryRepository.js';
import { Restaurant } from '../../domain/models/Restaurant.js';
import { EntityNotFoundError } from '../../domain/errors/DomainErrors.js';

export class GetRestaurantUseCase {
  constructor(
    private restaurantRepo: RestaurantRepository,
    private categoryRepo?: CategoryRepository
  ) {}

  async execute(identifier: string): Promise<Restaurant> {
    let restaurant = await this.restaurantRepo.findBySlug(identifier);
    if (!restaurant) {
      restaurant = await this.restaurantRepo.findById(identifier);
    }
    if (!restaurant || restaurant.isActive === false) {
      throw new EntityNotFoundError('Restaurant not found');
    }

    if (this.categoryRepo) {
      try {
        const dbCategories = await this.categoryRepo.findByRestaurantId(restaurant.id);
        if (dbCategories && dbCategories.length > 0) {
          const activeNames = dbCategories
            .filter((c) => c.isActive !== false)
            .map((c) => c.name);
          if (activeNames.length > 0) {
            restaurant = {
              ...restaurant,
              categories: activeNames,
            };
          }
        }
      } catch (err) {
        // Fallback gracefully
      }
    }

    return restaurant;
  }
}
