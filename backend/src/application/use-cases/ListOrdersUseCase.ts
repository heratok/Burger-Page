import { OrderRepository } from '../../domain/ports/out/OrderRepository.js';
import { Order } from '../../domain/models/Order.js';

export class ListOrdersUseCase {
  constructor(private orderRepo: OrderRepository) {}

  async execute(): Promise<Order[]> {
    return this.orderRepo.findAll();
  }
}
