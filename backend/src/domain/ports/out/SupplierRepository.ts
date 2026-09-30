import { Supplier } from '../../models/Supplier.js';

export interface SupplierRepository {
  findByRestaurantId(restaurantId: string): Promise<Supplier[]>;
  findById(id: string, restaurantId: string): Promise<Supplier | null>;
  save(supplier: Supplier): Promise<void>;
  delete(id: string, restaurantId: string): Promise<void>;
}
