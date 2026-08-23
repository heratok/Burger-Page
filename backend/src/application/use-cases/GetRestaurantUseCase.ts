import { RestaurantRepository } from '../../domain/ports/out/RestaurantRepository.js';
import { Restaurant } from '../../domain/models/Restaurant.js';
import { EntityNotFoundError } from '../../domain/errors/DomainErrors.js';

export class GetRestaurantUseCase {
  constructor(private restaurantRepo: RestaurantRepository) {}

  async execute(id: string): Promise<Restaurant> {
    const restaurant = await this.restaurantRepo.findById(id);
    if (!restaurant) throw new EntityNotFoundError('Restaurant not found');
    return restaurant;
  }
}
