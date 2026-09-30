import { SupplierRepository } from '../../domain/ports/out/SupplierRepository.js';
import { Supplier } from '../../domain/models/Supplier.js';

export class ListSuppliersUseCase {
  constructor(private supplierRepo: SupplierRepository) {}

  async execute(restaurantId: string): Promise<Supplier[]> {
    return this.supplierRepo.findByRestaurantId(restaurantId);
  }
}
