import { OrderRepository } from '../../domain/ports/out/OrderRepository.js';
import { UpdateOrderStatusDTO } from '../dtos/index.js';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/DomainErrors.js';
import { Order } from '../../domain/models/Order.js';
import { UserRole } from '../../domain/models/User.js';

export class UpdateOrderStatusUseCase {
  constructor(private orderRepo: OrderRepository) {}

  async execute(id: string, dto: UpdateOrderStatusDTO, restaurantId: string, actorId?: string, actorRole?: UserRole): Promise<Order> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant ID is required to update order status.');
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
      throw new EntityNotFoundError(`Order ${id} not found for restaurant ${restaurantId}`);
    }

    // 1. Validar máquina de estados en el Dominio
    // M1: capture the validated snapshot BEFORE transitionTo mutates it — the
    // CAS compare must be against the state the domain read, not the target.
    const previousStatus = order.status;
    order.transitionTo(dto.status);

    // 2. Persistir cambio de estado con aislamiento, actor y CAS: el repo
    // recibe el snapshot validado como expectedStatus, de modo que una
    // escritura concurrente (delivered -> cooking, cancel tras delivery)
    // levanta InvalidOrderStateError en vez de regresar el status.
    await this.orderRepo.updateStatus(id, dto.status, resolvedRestId, actorId, actorRole, previousStatus);

    return order;
  }
}
