import { randomUUID } from 'node:crypto';
import { SupplierRepository } from '../../domain/ports/out/SupplierRepository.js';
import { Supplier } from '../../domain/models/Supplier.js';
import { CreateSupplierInput } from '@burger-page/contracts';
import { ValidationError } from '../../domain/errors/DomainErrors.js';

export class CreateSupplierUseCase {
  constructor(private supplierRepo: SupplierRepository) {}

  async execute(restaurantId: string, input: CreateSupplierInput): Promise<Supplier> {
    const trimmedName = input.name?.trim();
    if (!trimmedName) {
      throw new ValidationError('Supplier name is required');
    }

    const now = new Date().toISOString();
    const supplier: Supplier = {
      id: input.id || `sup-${randomUUID()}`,
      restaurantId,
      name: trimmedName,
      category: input.category?.trim() || 'general',
      contactName: input.contactName?.trim() || '',
      phone: input.phone?.trim() || '',
      email: input.email?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    await this.supplierRepo.save(supplier);
    return supplier;
  }
}
