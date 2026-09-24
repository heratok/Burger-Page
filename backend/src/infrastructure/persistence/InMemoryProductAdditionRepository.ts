import { ProductAddition } from '../../domain/models/ProductAddition.js';
import { ProductAdditionRepository } from '../../domain/ports/out/ProductAdditionRepository.js';
import { ListOptions } from '../../domain/ports/out/ListOptions.js';

export class InMemoryProductAdditionRepository implements ProductAdditionRepository {
  private additions: Map<string, ProductAddition> = new Map();

  async findById(id: string, restaurantId: string): Promise<ProductAddition | null> {
    const item = this.additions.get(id);
    if (!item) return null;
    if (item.restaurantId !== restaurantId) return null;
    return item;
  }

  async findByRestaurantId(restaurantId: string, options?: ListOptions): Promise<ProductAddition[]> {
    const filtered = Array.from(this.additions.values()).filter((a) => a.restaurantId === restaurantId);
    const limit = options?.limit;
    if (typeof limit === 'number' && Number.isInteger(limit) && limit > 0) {
      const page = options?.page && Number.isInteger(options.page) && options.page >= 1 ? options.page : 1;
      const start = (page - 1) * limit;
      return filtered.slice(start, start + limit);
    }
    return filtered;
  }

  async countByRestaurantId(restaurantId: string): Promise<number> {
    return Array.from(this.additions.values()).filter((a) => a.restaurantId === restaurantId).length;
  }

  async findByProductId(productId: string, restaurantId: string): Promise<ProductAddition[]> {
    return Array.from(this.additions.values()).filter(
      (a) => a.restaurantId === restaurantId && (!a.productId || a.productId === productId)
    );
  }

  async save(addition: ProductAddition): Promise<void> {
    this.additions.set(addition.id, addition);
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    const item = this.additions.get(id);
    if (item && item.restaurantId === restaurantId) {
      this.additions.delete(id);
    }
  }

  clear(): void {
    this.additions.clear();
  }
}
