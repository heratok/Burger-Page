import { OrderRepository } from '../../domain/ports/out/OrderRepository.js';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/DomainErrors.js';
import { Order } from '../../domain/models/Order.js';

export class DeleteOrderUseCase {
  constructor(private orderRepo: OrderRepository) {}

  async execute(id: string, restaurantId: string): Promise<Order> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant context is required to delete an order.');
    }

    const order = await this.orderRepo.findById(id, restaurantId);
    if (!order) {
      throw new EntityNotFoundError(`Order '${id}' not found for restaurant '${restaurantId}'.`);
    }

    await this.orderRepo.delete(id, restaurantId);
    return order;
  }
}
