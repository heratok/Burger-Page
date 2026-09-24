import { OrderRepository } from '../../domain/ports/out/OrderRepository.js';
import { Order } from '../../domain/models/Order.js';
import { ValidationError } from '../../domain/errors/DomainErrors.js';
import { ListOptions, PaginatedResult } from '../../domain/ports/out/ListOptions.js';

export class ListOrdersUseCase {
  constructor(private orderRepo: OrderRepository) {}

  async execute(restaurantId: string): Promise<Order[]>;
  async execute(restaurantId: string, options: ListOptions): Promise<PaginatedResult<Order>>;
  async execute(restaurantId: string, options?: ListOptions): Promise<Order[] | PaginatedResult<Order>> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant ID is required to list orders.');
    }

    if (options?.limit !== undefined) {
      const [items, total] = await Promise.all([
        this.orderRepo.findByRestaurantId(restaurantId, options),
        this.orderRepo.countByRestaurantId?.(restaurantId),
      ]);
      return { items, total: total ?? items.length };
    }

    return this.orderRepo.findByRestaurantId(restaurantId);
  }
}