import { randomUUID } from 'node:crypto';
import { RestaurantRepository } from '../../domain/ports/out/RestaurantRepository.js';
import { CategoryRepository } from '../../domain/ports/out/CategoryRepository.js';
import { Restaurant } from '../../domain/models/Restaurant.js';
import { EntityNotFoundError } from '../../domain/errors/DomainErrors.js';

export class UpdateRestaurantCategoriesUseCase {
  constructor(
    private restaurantRepo: RestaurantRepository,
    private categoryRepo?: CategoryRepository
  ) {}

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

    if (this.categoryRepo) {
      try {
        const existing = await this.categoryRepo.findByRestaurantId(restaurant.id);
        const existingByName = new Map(existing.map((c) => [c.name.toLowerCase(), c]));

        for (let i = 0; i < cleanedCategories.length; i++) {
          const name = cleanedCategories[i];
          const found = existingByName.get(name.toLowerCase());
          if (found) {
            await this.categoryRepo.save({
              ...found,
              name,
              displayOrder: i,
              isActive: true,
            });
          } else {
            await this.categoryRepo.save({
              id: `cat_${randomUUID()}`,
              restaurantId: restaurant.id,
              name,
              displayOrder: i,
              isActive: true,
            });
          }
        }

        // Deactivate categories no longer in cleanedCategories
        const cleanedSet = new Set(cleanedCategories.map((c) => c.toLowerCase()));
        for (const cat of existing) {
          if (!cleanedSet.has(cat.name.toLowerCase()) && cat.isActive) {
            await this.categoryRepo.save({
              ...cat,
              isActive: false,
            });
          }
        }
      } catch (err) {
        console.warn('Could not sync categories to CategoryRepository:', err);
      }
    }

    return updatedRestaurant;
  }
}
