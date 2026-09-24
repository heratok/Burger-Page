import { ProductRepository } from '../../domain/ports/out/ProductRepository.js';
import { Product } from '../../domain/models/Product.js';
import { ListOptions } from '../../domain/ports/out/ListOptions.js';
import { initialProducts } from './seedData.js';

export class InMemoryProductRepository implements ProductRepository {
  private products: Map<string, Product> = new Map();

  constructor() {
    for (const p of initialProducts) {
      this.products.set(p.id, { ...p });
    }
  }

  async findById(id: string, restaurantId: string): Promise<Product | null> {
    const product = this.products.get(id);
    if (!product) return null;
    if (product.restaurantId !== restaurantId) return null;
    return { ...product };
  }

  async findByRestaurantId(restaurantId: string, options?: ListOptions): Promise<Product[]> {
    const filtered = Array.from(this.products.values()).filter((p) => p.restaurantId === restaurantId);
    const limit = options?.limit;
    if (typeof limit === 'number' && Number.isInteger(limit) && limit > 0) {
      const page = options?.page && Number.isInteger(options.page) && options.page >= 1 ? options.page : 1;
      const start = (page - 1) * limit;
      return filtered.slice(start, start + limit).map((p) => ({ ...p }));
    }
    return filtered.map((p) => ({ ...p }));
  }

  async countByRestaurantId(restaurantId: string): Promise<number> {
    return Array.from(this.products.values()).filter((p) => p.restaurantId === restaurantId).length;
  }

  async save(product: Product): Promise<void> {
    this.products.set(product.id, { ...product });
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    const product = this.products.get(id);
    if (product && product.restaurantId === restaurantId) {
      this.products.delete(id);
    }
  }

  clear(): void {
    this.products.clear();
  }
}
