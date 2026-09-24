import { CustomerRepository } from '../../domain/ports/out/CustomerRepository.js';
import { Customer } from '../../domain/models/Customer.js';
import { ValidationError } from '../../domain/errors/DomainErrors.js';
import { ListOptions, PaginatedResult } from '../../domain/ports/out/ListOptions.js';

export class ListCustomersUseCase {
  constructor(private customerRepo: CustomerRepository) {}

  async execute(restaurantId: string): Promise<Customer[]>;
  async execute(restaurantId: string, options: ListOptions): Promise<PaginatedResult<Customer>>;
  async execute(restaurantId: string, options?: ListOptions): Promise<Customer[] | PaginatedResult<Customer>> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant ID is required to list customers.');
    }

    if (options?.limit !== undefined) {
      const [items, total] = await Promise.all([
        this.customerRepo.findByRestaurantId(restaurantId, options),
        this.customerRepo.countByRestaurantId?.(restaurantId),
      ]);
      return { items, total: total ?? items.length };
    }

    return this.customerRepo.findByRestaurantId(restaurantId);
  }
}