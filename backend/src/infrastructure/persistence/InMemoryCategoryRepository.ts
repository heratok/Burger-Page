import { CategoryRepository } from '../../domain/ports/out/CategoryRepository.js';
import { Category } from '../../domain/models/Category.js';
import { initialCategories } from './seedData.js';

export class InMemoryCategoryRepository implements CategoryRepository {
  private categories: Map<string, Category> = new Map();

  constructor(initial: Category[] = initialCategories) {
    for (const c of initial) {
      this.categories.set(c.id, { ...c });
    }
  }

  async findById(id: string, restaurantId: string): Promise<Category | null> {
    const cat = this.categories.get(id);
    if (!cat || cat.restaurantId !== restaurantId) return null;
    return { ...cat };
  }

  async findByRestaurantId(restaurantId: string): Promise<Category[]> {
    return Array.from(this.categories.values())
      .filter((c) => c.restaurantId === restaurantId)
      .map((c) => ({ ...c }));
  }

  async findByName(name: string, restaurantId: string): Promise<Category | null> {
    const cat = Array.from(this.categories.values()).find(
      (c) => c.restaurantId === restaurantId && c.name.toLowerCase() === name.toLowerCase()
    );
    if (!cat) return null;
    return { ...cat };
  }

  async save(category: Category): Promise<void> {
    this.categories.set(category.id, { ...category });
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    const cat = this.categories.get(id);
    if (cat && cat.restaurantId === restaurantId) {
      this.categories.delete(id);
    }
  }

  clear(): void {
    this.categories.clear();
  }
}
