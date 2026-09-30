import { Database } from 'better-sqlite3';
import { Supplier } from '../../../domain/models/Supplier.js';
import { SupplierRepository } from '../../../domain/ports/out/SupplierRepository.js';

export class SqliteSupplierRepository implements SupplierRepository {
  constructor(private db: Database) {}

  private mapToDomain(row: any): Supplier {
    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      name: row.name,
      category: row.category || 'general',
      contactName: row.contact_name || '',
      phone: row.phone || '',
      email: row.email || undefined,
      notes: row.notes || undefined,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    };
  }

  async findById(id: string, restaurantId: string): Promise<Supplier | null> {
    const row = this.db
      .prepare('SELECT * FROM suppliers WHERE id = ? AND restaurant_id = ?')
      .get(id, restaurantId) as any;
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async findByRestaurantId(restaurantId: string): Promise<Supplier[]> {
    const rows = this.db
      .prepare('SELECT * FROM suppliers WHERE restaurant_id = ? ORDER BY name ASC')
      .all(restaurantId) as any[];
    return rows.map((r) => this.mapToDomain(r));
  }

  async save(supplier: Supplier): Promise<void> {
    const existing = this.db
      .prepare('SELECT id FROM suppliers WHERE id = ?')
      .get(supplier.id);

    if (existing) {
      this.db
        .prepare(`
          UPDATE suppliers
          SET name = ?, category = ?, contact_name = ?, phone = ?, email = ?, notes = ?, updated_at = ?
          WHERE id = ? AND restaurant_id = ?
        `)
        .run(
          supplier.name,
          supplier.category || 'general',
          supplier.contactName || '',
          supplier.phone || '',
          supplier.email || '',
          supplier.notes || null,
          supplier.updatedAt || new Date().toISOString(),
          supplier.id,
          supplier.restaurantId
        );
    } else {
      this.db
        .prepare(`
          INSERT INTO suppliers (id, restaurant_id, name, category, contact_name, phone, email, notes, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          supplier.id,
          supplier.restaurantId,
          supplier.name,
          supplier.category || 'general',
          supplier.contactName || '',
          supplier.phone || '',
          supplier.email || '',
          supplier.notes || null,
          supplier.createdAt || new Date().toISOString(),
          supplier.updatedAt || new Date().toISOString()
        );
    }
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    this.db
      .prepare('DELETE FROM suppliers WHERE id = ? AND restaurant_id = ?')
      .run(id, restaurantId);
  }
}
