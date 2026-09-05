import { RestaurantRepository } from '../../domain/ports/out/RestaurantRepository.js';
import { Restaurant } from '../../domain/models/Restaurant.js';

export class ListRestaurantsUseCase {
  constructor(private restaurantRepo: RestaurantRepository) {}

  async execute(): Promise<Restaurant[]> {
    return this.restaurantRepo.findAll();
  }
}
