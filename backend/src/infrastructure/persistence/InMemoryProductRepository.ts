import { ProductRepository } from '../../domain/ports/out/ProductRepository.js';
import { Product } from '../../domain/models/Product.js';
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

  async findByRestaurantId(restaurantId: string): Promise<Product[]> {
    return Array.from(this.products.values())
      .filter((p) => p.restaurantId === restaurantId)
      .map((p) => ({ ...p }));
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
