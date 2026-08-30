import { ProductAddition } from '../../domain/models/ProductAddition.js';
import { ProductAdditionRepository } from '../../domain/ports/out/ProductAdditionRepository.js';

export class InMemoryProductAdditionRepository implements ProductAdditionRepository {
  private additions: Map<string, ProductAddition> = new Map();

  async findById(id: string, restaurantId: string): Promise<ProductAddition | null> {
    const item = this.additions.get(id);
    if (!item) return null;
    if (item.restaurantId !== restaurantId) return null;
    return item;
  }

  async findByRestaurantId(restaurantId: string): Promise<ProductAddition[]> {
    return Array.from(this.additions.values()).filter((a) => a.restaurantId === restaurantId);
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
