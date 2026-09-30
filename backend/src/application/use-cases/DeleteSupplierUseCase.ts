import { SupplierRepository } from '../../domain/ports/out/SupplierRepository.js';
import { EntityNotFoundError } from '../../domain/errors/DomainErrors.js';

export class DeleteSupplierUseCase {
  constructor(private supplierRepo: SupplierRepository) {}

  async execute(id: string, restaurantId: string): Promise<void> {
    const existing = await this.supplierRepo.findById(id, restaurantId);
    if (!existing) {
      throw new EntityNotFoundError(`Supplier "${id}" not found`);
    }
    await this.supplierRepo.delete(id, restaurantId);
  }
}
