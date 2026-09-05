import { Database } from 'better-sqlite3';
import { Category } from '../../../domain/models/Category.js';
import { CategoryRepository } from '../../../domain/ports/out/CategoryRepository.js';

export class SqliteCategoryRepository implements CategoryRepository {
  constructor(private db: Database) {}

  private mapRow(row: any): Category {
    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      name: row.name,
      slug: row.slug || undefined,
      displayOrder: Number(row.display_order || 0),
      isActive: Boolean(row.is_active !== undefined ? row.is_active : 1),
    };
  }

  async findById(id: string, restaurantId: string): Promise<Category | null> {
    const row = this.db
      .prepare('SELECT * FROM categories WHERE id = ? AND restaurant_id = ?')
      .get(id, restaurantId) as any;
    if (!row) return null;
    return this.mapRow(row);
  }

  async findByRestaurantId(restaurantId: string): Promise<Category[]> {
    const rows = this.db
      .prepare('SELECT * FROM categories WHERE restaurant_id = ? ORDER BY display_order ASC, name ASC')
      .all(restaurantId) as any[];
    return rows.map((r) => this.mapRow(r));
  }

  async findByName(name: string, restaurantId: string): Promise<Category | null> {
    const row = this.db
      .prepare('SELECT * FROM categories WHERE LOWER(name) = LOWER(?) AND restaurant_id = ?')
      .get(name, restaurantId) as any;
    if (!row) return null;
    return this.mapRow(row);
  }

  async save(category: Category): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO categories (id, restaurant_id, name, slug, display_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        slug = excluded.slug,
        display_order = excluded.display_order,
        is_active = excluded.is_active
      WHERE categories.restaurant_id = excluded.restaurant_id
    `);

    stmt.run(
      category.id,
      category.restaurantId,
      category.name,
      category.slug || null,
      category.displayOrder || 0,
      category.isActive === false ? 0 : 1
    );
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    this.db
      .prepare('DELETE FROM categories WHERE id = ? AND restaurant_id = ?')
      .run(id, restaurantId);
  }
}
