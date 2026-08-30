import { CustomerRepository } from '../../domain/ports/out/CustomerRepository.js';
import { Customer } from '../../domain/models/Customer.js';
import { UpdateCustomerDTO } from '../dtos/index.js';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/DomainErrors.js';

export class UpdateCustomerUseCase {
  constructor(private customerRepo: CustomerRepository) {}

  async execute(id: string, dto: UpdateCustomerDTO, restaurantId: string): Promise<Customer> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant ID is required to update a customer.');
    }
    const customer = await this.customerRepo.findById(id, restaurantId);
    if (!customer) {
      throw new EntityNotFoundError(`Customer '${id}' not found for restaurant '${restaurantId}'.`);
    }

    if (dto.name !== undefined) {
      if (!dto.name.trim()) throw new ValidationError('Customer name cannot be empty.');
      customer.name = dto.name.trim();
    }
    if (dto.phone !== undefined) {
      if (!dto.phone.trim()) throw new ValidationError('Customer phone cannot be empty.');
      customer.phone = dto.phone.trim();
    }
    if (dto.address !== undefined) customer.address = dto.address.trim();
    if (dto.barrio !== undefined) customer.barrio = dto.barrio.trim();
    if (dto.notes !== undefined) customer.notes = dto.notes.trim();
    if (dto.email !== undefined) customer.email = dto.email.trim();

    customer.updatedAt = new Date().toISOString();
    await this.customerRepo.save(customer);
    return customer;
  }
}
