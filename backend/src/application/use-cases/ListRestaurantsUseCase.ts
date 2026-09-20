import { RestaurantRepository } from '../../domain/ports/out/RestaurantRepository.js';
import { Restaurant, omitAdminPassword } from '../../domain/models/Restaurant.js';

export class ListRestaurantsUseCase {
  constructor(private restaurantRepo: RestaurantRepository) {}

  async execute(): Promise<Restaurant[]> {
    const restaurants = await this.restaurantRepo.findAll();
    // SUS-20: one-time admin credentials must never leave through read paths.
    return restaurants.map(omitAdminPassword);
  }
}
