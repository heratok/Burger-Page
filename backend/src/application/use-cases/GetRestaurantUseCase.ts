import { RestaurantRepository } from '../../domain/ports/out/RestaurantRepository.js';
import { Restaurant } from '../../domain/models/Restaurant.js';
import { EntityNotFoundError } from '../../domain/errors/DomainErrors.js';

export class GetRestaurantUseCase {
  constructor(private restaurantRepo: RestaurantRepository) {}

  async execute(identifier: string): Promise<Restaurant> {
    let restaurant = await this.restaurantRepo.findBySlug(identifier);
    if (!restaurant) {
      restaurant = await this.restaurantRepo.findById(identifier);
    }
    if (!restaurant || restaurant.isActive === false) {
      throw new EntityNotFoundError('Restaurant not found');
    }
    return restaurant;
  }
}
