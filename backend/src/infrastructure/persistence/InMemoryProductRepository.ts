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

  async findById(id: string): Promise<Product | null> {
    return this.products.get(id) || null;
  }

  async findAll(): Promise<Product[]> {
    return Array.from(this.products.values());
  }

  async save(product: Product): Promise<void> {
    this.products.set(product.id, { ...product });
  }

  async delete(id: string): Promise<void> {
    this.products.delete(id);
  }
}
