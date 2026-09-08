import { OrderRepository } from '../../domain/ports/out/OrderRepository.js';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/DomainErrors.js';
import { Order } from '../../domain/models/Order.js';

export class DeleteOrderUseCase {
  constructor(private readonly orderRepo: OrderRepository) {}

  async execute(id: string, restaurantId: string): Promise<Order> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant context is required to delete an order.');
    }

    let order = await this.orderRepo.findById(id, restaurantId);
    let resolvedRestId = restaurantId;

    if (!order) {
      const altRestId = restaurantId.startsWith('rest-')
        ? restaurantId.replace(/^rest-/, '')
        : `rest-${restaurantId}`;
      const altOrder = await this.orderRepo.findById(id, altRestId);
      if (altOrder) {
        order = altOrder;
        resolvedRestId = altRestId;
      }
    }

    if (!order) {
      throw new EntityNotFoundError(`Order '${id}' not found for restaurant '${restaurantId}'.`);
    }

    await this.orderRepo.delete(id, resolvedRestId);
    return order;
  }
}
