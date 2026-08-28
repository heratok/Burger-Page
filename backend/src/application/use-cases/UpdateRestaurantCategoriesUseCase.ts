import { RestaurantRepository } from '../../domain/ports/out/RestaurantRepository.js';
import { Restaurant } from '../../domain/models/Restaurant.js';
import { EntityNotFoundError } from '../../domain/errors/DomainErrors.js';

export class UpdateRestaurantCategoriesUseCase {
  constructor(private restaurantRepo: RestaurantRepository) {}

  async execute(identifier: string, categories: string[]): Promise<Restaurant> {
    let restaurant = await this.restaurantRepo.findBySlug(identifier);
    if (!restaurant) {
      restaurant = await this.restaurantRepo.findById(identifier);
    }
    if (!restaurant) throw new EntityNotFoundError('Restaurant not found');

    // Clean and deduplicate categories
    const cleanedCategories = Array.from(
      new Set(categories.map((c) => c.trim()).filter((c) => c.length > 0))
    );

    const updatedRestaurant: Restaurant = {
      ...restaurant,
      categories: cleanedCategories,
    };

    await this.restaurantRepo.save(updatedRestaurant);
    return updatedRestaurant;
  }
}
