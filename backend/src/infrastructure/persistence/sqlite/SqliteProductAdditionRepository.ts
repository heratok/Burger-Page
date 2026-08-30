import { Database } from 'better-sqlite3';
import { ProductAddition } from '../../../domain/models/ProductAddition.js';
import { ProductAdditionRepository } from '../../../domain/ports/out/ProductAdditionRepository.js';

export class SqliteProductAdditionRepository implements ProductAdditionRepository {
  constructor(private db: Database) {}

  private mapRow(row: any): ProductAddition {
    return new ProductAddition(
      row.id,
      row.restaurant_id,
      row.name,
      Number(row.price),
      Boolean(row.is_available),
      row.product_id || undefined,
      Number(row.display_order || 0)
    );
  }

  async findById(id: string, restaurantId: string): Promise<ProductAddition | null> {
    const row = this.db
      .prepare('SELECT * FROM product_additions WHERE id = ? AND restaurant_id = ?')
      .get(id, restaurantId) as any;
    if (!row) return null;
    return this.mapRow(row);
  }

  async findByRestaurantId(restaurantId: string): Promise<ProductAddition[]> {
    const rows = this.db
      .prepare('SELECT * FROM product_additions WHERE restaurant_id = ? ORDER BY display_order ASC, id ASC')
      .all(restaurantId) as any[];
    return rows.map((r) => this.mapRow(r));
  }

  async findByProductId(productId: string, restaurantId: string): Promise<ProductAddition[]> {
    const rows = this.db
      .prepare('SELECT * FROM product_additions WHERE restaurant_id = ? AND (product_id = ? OR product_id IS NULL) ORDER BY display_order ASC, id ASC')
      .all(restaurantId, productId) as any[];
    return rows.map((r) => this.mapRow(r));
  }

  async save(addition: ProductAddition): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO product_additions (id, restaurant_id, product_id, name, price, is_available, display_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        restaurant_id = excluded.restaurant_id,
        product_id = excluded.product_id,
        name = excluded.name,
        price = excluded.price,
        is_available = excluded.is_available,
        display_order = excluded.display_order
    `);
    stmt.run(
      addition.id,
      addition.restaurantId,
      addition.productId || null,
      addition.name,
      addition.price,
      addition.isAvailable ? 1 : 0,
      addition.displayOrder || 0
    );
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    this.db
      .prepare('DELETE FROM product_additions WHERE id = ? AND restaurant_id = ?')
      .run(id, restaurantId);
  }
}
