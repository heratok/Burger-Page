import { SupplierRepository } from '../../domain/ports/out/SupplierRepository.js';
import { Supplier } from '../../domain/models/Supplier.js';
import { UpdateSupplierInput } from '@burger-page/contracts';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/DomainErrors.js';

export class UpdateSupplierUseCase {
  constructor(private supplierRepo: SupplierRepository) {}

  async execute(id: string, restaurantId: string, input: UpdateSupplierInput): Promise<Supplier> {
    const existing = await this.supplierRepo.findById(id, restaurantId);
    if (!existing) {
      throw new EntityNotFoundError(`Supplier "${id}" not found`);
    }

    if (input.name !== undefined && !input.name.trim()) {
      throw new ValidationError('Supplier name cannot be empty');
    }

    const updated: Supplier = {
      ...existing,
      name: input.name !== undefined ? input.name.trim() : existing.name,
      category: input.category !== undefined ? input.category.trim() : existing.category,
      contactName: input.contactName !== undefined ? input.contactName.trim() : existing.contactName,
      phone: input.phone !== undefined ? input.phone.trim() : existing.phone,
      email: input.email !== undefined ? input.email.trim() : existing.email,
      notes: input.notes !== undefined ? input.notes.trim() : existing.notes,
      updatedAt: new Date().toISOString(),
    };

    await this.supplierRepo.save(updated);
    return updated;
  }
}
