import { OrderRepository } from '../../domain/ports/out/OrderRepository.js';
import { UpdateOrderReceiptDTO } from '../dtos/index.js';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/DomainErrors.js';
import { Order } from '../../domain/models/Order.js';

export class UpdateOrderReceiptUseCase {
  constructor(private orderRepo: OrderRepository) {}

  async execute(id: string, dto: UpdateOrderReceiptDTO, restaurantId: string): Promise<Order> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant ID is required to update order receipt.');
    }

    const order = await this.orderRepo.findById(id, restaurantId);
    if (!order) {
      throw new EntityNotFoundError(`Order ${id} not found for restaurant ${restaurantId}`);
    }

    order.receiptUrl = dto.receiptUrl;
    await this.orderRepo.updateReceipt(id, dto.receiptUrl, restaurantId);

    return order;
  }
}
