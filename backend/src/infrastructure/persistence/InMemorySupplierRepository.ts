import { SupplierRepository } from '../../domain/ports/out/SupplierRepository.js';
import { Supplier } from '../../domain/models/Supplier.js';

export class InMemorySupplierRepository implements SupplierRepository {
  private suppliers: Map<string, Supplier> = new Map();

  constructor(initial: Supplier[] = []) {
    for (const s of initial) {
      this.suppliers.set(s.id, { ...s });
    }
  }

  async findByRestaurantId(restaurantId: string): Promise<Supplier[]> {
    return Array.from(this.suppliers.values())
      .filter((s) => s.restaurantId === restaurantId)
      .map((s) => ({ ...s }));
  }

  async findById(id: string, restaurantId: string): Promise<Supplier | null> {
    const s = this.suppliers.get(id);
    if (!s || s.restaurantId !== restaurantId) return null;
    return { ...s };
  }

  async save(supplier: Supplier): Promise<void> {
    this.suppliers.set(supplier.id, { ...supplier });
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    const s = this.suppliers.get(id);
    if (s && s.restaurantId === restaurantId) {
      this.suppliers.delete(id);
    }
  }
}
