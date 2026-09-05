import { CustomerRepository } from '../../domain/ports/out/CustomerRepository.js';
import { Customer } from '../../domain/models/Customer.js';
import { ValidationError } from '../../domain/errors/DomainErrors.js';

export class ListCustomersUseCase {
  constructor(private customerRepo: CustomerRepository) {}

  async execute(restaurantId: string): Promise<Customer[]> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant ID is required to list customers.');
    }
    return this.customerRepo.findByRestaurantId(restaurantId);
  }
}
