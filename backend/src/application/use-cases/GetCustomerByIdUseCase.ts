import { CustomerRepository } from '../../domain/ports/out/CustomerRepository.js';
import { Customer } from '../../domain/models/Customer.js';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/DomainErrors.js';

export class GetCustomerByIdUseCase {
  constructor(private customerRepo: CustomerRepository) {}

  async execute(id: string, restaurantId: string): Promise<Customer> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant ID is required to fetch customer details.');
    }
    const customer = await this.customerRepo.findById(id, restaurantId);
    if (!customer) {
      throw new EntityNotFoundError(`Customer '${id}' not found for restaurant '${restaurantId}'.`);
    }
    return customer;
  }
}
