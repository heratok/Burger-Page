import { OrderRepository } from '../../domain/ports/out/OrderRepository.js';
import { Order } from '../../domain/models/Order.js';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/DomainErrors.js';

export class GetOrderByIdUseCase {
  constructor(private orderRepo: OrderRepository) {}

  async execute(id: string, restaurantId: string): Promise<Order> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant ID is required to fetch an order.');
    }
    const order = await this.orderRepo.findById(id, restaurantId);
    if (!order) {
      throw new EntityNotFoundError(`Order ${id} not found for restaurant ${restaurantId}`);
    }
    return order;
  }
}
