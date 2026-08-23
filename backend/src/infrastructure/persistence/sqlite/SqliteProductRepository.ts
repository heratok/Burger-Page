import { Database } from 'better-sqlite3';
import { Product } from '../../../domain/models/Product.js';
import { ProductRepository } from '../../../domain/ports/out/ProductRepository.js';

export class SqliteProductRepository implements ProductRepository {
  constructor(private db: Database) {}

  async findById(id: string): Promise<Product | null> {
    const row = this.db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      price: row.price,
      category: row.category,
      isAvailable: Boolean(row.is_available),
      additions: JSON.parse(row.additions || '[]')
    };
  }

  async findAll(): Promise<Product[]> {
    const rows = this.db.prepare('SELECT * FROM products').all() as any[];
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      price: row.price,
      category: row.category,
      isAvailable: Boolean(row.is_available),
      additions: JSON.parse(row.additions || '[]')
    }));
  }

  async save(product: Product): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO products (id, name, description, price, category, is_available, additions)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        price = excluded.price,
        category = excluded.category,
        is_available = excluded.is_available,
        additions = excluded.additions
    `);
    stmt.run(
      product.id,
      product.name,
      product.description,
      product.price,
      product.category,
      product.isAvailable ? 1 : 0,
      JSON.stringify(product.additions || [])
    );
  }

  async delete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM products WHERE id = ?').run(id);
  }
}
