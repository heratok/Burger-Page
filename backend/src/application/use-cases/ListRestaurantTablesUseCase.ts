import { RestaurantTableRepository } from '../../domain/ports/out/RestaurantTableRepository.js';
import { RestaurantTable } from '../../domain/models/RestaurantTable.js';

export class ListRestaurantTablesUseCase {
  constructor(private tableRepo: RestaurantTableRepository) {}

  async execute(restaurantId: string): Promise<RestaurantTable[]> {
    return this.tableRepo.findByRestaurantId(restaurantId);
  }
}
