import { OrderRepository } from '../../domain/ports/out/OrderRepository.js';
import { UpdateOrderStatusDTO } from '../dtos/index.js';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/DomainErrors.js';
import { Order } from '../../domain/models/Order.js';

export class UpdateOrderStatusUseCase {
  constructor(private orderRepo: OrderRepository) {}

  async execute(id: string, dto: UpdateOrderStatusDTO, restaurantId: string, actorId?: string): Promise<Order> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant ID is required to update order status.');
    }

    const order = await this.orderRepo.findById(id, restaurantId);
    if (!order) {
      throw new EntityNotFoundError(`Order ${id} not found for restaurant ${restaurantId}`);
    }

    // 1. Validar máquina de estados en el Dominio
    order.transitionTo(dto.status);

    // 2. Persistir cambio de estado con aislamiento y actor
    await this.orderRepo.updateStatus(id, dto.status, restaurantId, actorId);

    return order;
  }
}
