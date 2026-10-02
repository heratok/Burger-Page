import { RestaurantRepository } from '../../domain/ports/out/RestaurantRepository.js';
import { DeletedRestaurant } from '../../domain/models/Restaurant.js';

export class ListDeletedRestaurantsUseCase {
  constructor(private restaurantRepo: RestaurantRepository) {}

  execute(): Promise<DeletedRestaurant[]> {
    return this.restaurantRepo.findDeleted();
  }
}
