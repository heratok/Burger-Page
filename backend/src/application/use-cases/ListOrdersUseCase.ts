import { OrderRepository } from '../../domain/ports/out/OrderRepository.js';
import { Order } from '../../domain/models/Order.js';
import { ValidationError } from '../../domain/errors/DomainErrors.js';

export class ListOrdersUseCase {
  constructor(private orderRepo: OrderRepository) {}

  async execute(restaurantId: string): Promise<Order[]> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant ID is required to list orders.');
    }
    return this.orderRepo.findByRestaurantId(restaurantId);
  }
}
