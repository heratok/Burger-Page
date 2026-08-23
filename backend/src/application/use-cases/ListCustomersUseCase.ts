import { CustomerRepository } from '../../domain/ports/out/CustomerRepository.js';
import { Customer } from '../../domain/models/Customer.js';

export class ListCustomersUseCase {
  constructor(private customerRepo: CustomerRepository) {}

  async execute(): Promise<Customer[]> {
    return this.customerRepo.findAll();
  }
}
