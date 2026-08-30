import { CustomerRepository } from '../../domain/ports/out/CustomerRepository.js';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/DomainErrors.js';

export class DeleteCustomerUseCase {
  constructor(private customerRepo: CustomerRepository) {}

  async execute(id: string, restaurantId: string): Promise<void> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant ID is required to delete a customer.');
    }
    const customer = await this.customerRepo.findById(id, restaurantId);
    if (!customer) {
      throw new EntityNotFoundError(`Customer '${id}' not found for restaurant '${restaurantId}'.`);
    }
    await this.customerRepo.delete(id, restaurantId);
  }
}
