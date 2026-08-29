import { OrderRepository } from '../../domain/ports/out/OrderRepository.js';
import { UpdateOrderStatusDTO } from '../dtos/index.js';
import { EntityNotFoundError } from '../../domain/errors/DomainErrors.js';
import { Order } from '../../domain/models/Order.js';

export class UpdateOrderStatusUseCase {
  constructor(private orderRepo: OrderRepository) {}

  async execute(id: string, dto: UpdateOrderStatusDTO): Promise<Order> {
    const order = await this.orderRepo.findById(id);
    if (!order) throw new EntityNotFoundError('Order not found');

    order.transitionTo(dto.status);
    await this.orderRepo.save(order);
    return order;
  }
}
