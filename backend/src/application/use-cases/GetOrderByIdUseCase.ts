import { OrderRepository } from '../../domain/ports/out/OrderRepository.js';
import { Order } from '../../domain/models/Order.js';
import { EntityNotFoundError } from '../../domain/errors/DomainErrors.js';

export class GetOrderByIdUseCase {
  constructor(private orderRepo: OrderRepository) {}

  async execute(id: string): Promise<Order> {
    const order = await this.orderRepo.findById(id);
    if (!order) throw new EntityNotFoundError('Order not found');
    return order;
  }
}
