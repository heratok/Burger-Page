import { randomUUID } from 'node:crypto';
import { CustomerRepository } from '../../domain/ports/out/CustomerRepository.js';
import { Customer } from '../../domain/models/Customer.js';
import { CreateCustomerDTO } from '../dtos/index.js';
import { ValidationError } from '../../domain/errors/DomainErrors.js';

export class CreateCustomerUseCase {
  constructor(private customerRepo: CustomerRepository) {}

  async execute(dto: CreateCustomerDTO, restaurantId: string): Promise<Customer> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant ID is required to create a customer.');
    }
    if (!dto.name || dto.name.trim() === '') {
      throw new ValidationError('Customer name is required.');
    }
    if (!dto.phone || dto.phone.trim() === '') {
      throw new ValidationError('Customer phone number is required.');
    }

    const trimmedPhone = dto.phone.trim();
    // Verificar si ya existe un cliente con ese teléfono en este restaurante
    const existing = await this.customerRepo.findByPhone(trimmedPhone, restaurantId);
    if (existing) {
      // Actualizar datos si cambiaron
      existing.name = dto.name.trim();
      if (dto.address !== undefined) existing.address = dto.address.trim();
      if (dto.barrio !== undefined) existing.barrio = dto.barrio.trim();
      if (dto.notes !== undefined) existing.notes = dto.notes.trim();
      if (dto.email !== undefined) existing.email = dto.email.trim();
      existing.updatedAt = new Date().toISOString();
      await this.customerRepo.save(existing);
      return existing;
    }

    const customer = new Customer(
      `cust_${randomUUID()}`,
      restaurantId,
      dto.name.trim(),
      trimmedPhone,
      dto.address?.trim() || '',
      dto.barrio?.trim() || '',
      dto.notes?.trim() || '',
      dto.email?.trim() || '',
      new Date().toISOString(),
      new Date().toISOString()
    );

    await this.customerRepo.save(customer);
    return customer;
  }
}
