import { Database } from 'better-sqlite3';
import { Product } from '../../../domain/models/Product.js';
import { ProductRepository } from '../../../domain/ports/out/ProductRepository.js';

export class SqliteProductRepository implements ProductRepository {
  constructor(private db: Database) {}

  private mapRow(row: any): Product {
    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      name: row.name,
      description: row.description,
      price: Number(row.price),
      category: row.category_name || row.category || 'General',
      categoryId: row.category_id || undefined,
      imageUrl: row.image_url || undefined,
      isAvailable: Boolean(row.is_available),
      isPopular: Boolean(row.is_popular),
      isNew: Boolean(row.is_new),
      preparationTimeMinutes: Number(row.preparation_time_minutes || 15),
      displayOrder: Number(row.display_order || 0),
      additions: JSON.parse(row.additions || '[]'),
    };
  }

  async findById(id: string, restaurantId: string): Promise<Product | null> {
    const row = this.db
      .prepare(`
        SELECT p.*, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id = ? AND p.restaurant_id = ?
      `)
      .get(id, restaurantId) as any;
    if (!row) return null;
    return this.mapRow(row);
  }

  async findByRestaurantId(restaurantId: string): Promise<Product[]> {
    const rows = this.db
      .prepare(`
        SELECT p.*, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.restaurant_id = ?
        ORDER BY p.display_order ASC, p.id ASC
      `)
      .all(restaurantId) as any[];
    return rows.map((r) => this.mapRow(r));
  }

  async save(product: Product): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO products (
        id, restaurant_id, name, description, price, category, category_id,
        image_url, is_available, is_popular, is_new, preparation_time_minutes, display_order, additions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        price = excluded.price,
        category = excluded.category,
        category_id = excluded.category_id,
        image_url = excluded.image_url,
        is_available = excluded.is_available,
        is_popular = excluded.is_popular,
        is_new = excluded.is_new,
        preparation_time_minutes = excluded.preparation_time_minutes,
        display_order = excluded.display_order,
        additions = excluded.additions
      WHERE products.restaurant_id = excluded.restaurant_id
    `);

    stmt.run(
      product.id,
      product.restaurantId,
      product.name,
      product.description || '',
      product.price,
      product.category,
      product.categoryId || null,
      product.imageUrl || null,
      product.isAvailable ? 1 : 0,
      product.isPopular ? 1 : 0,
      product.isNew ? 1 : 0,
      product.preparationTimeMinutes || 15,
      product.displayOrder || 0,
      JSON.stringify(product.additions || [])
    );
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    this.db
      .prepare('DELETE FROM products WHERE id = ? AND restaurant_id = ?')
      .run(id, restaurantId);
  }
}
