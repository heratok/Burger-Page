import { Database } from 'better-sqlite3';
import { RestaurantTable } from '../../../domain/models/RestaurantTable.js';
import { RestaurantTableRepository } from '../../../domain/ports/out/RestaurantTableRepository.js';
import { ConflictError } from '../../../domain/errors/DomainErrors.js';

export class SqliteRestaurantTableRepository implements RestaurantTableRepository {
  constructor(private db: Database) {}

  private mapToDomain(row: any): RestaurantTable {
    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      name: row.name,
      sortOrder: Number(row.sort_order ?? 0),
      isActive: Boolean(row.is_active),
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    };
  }

  async findByRestaurantId(restaurantId: string): Promise<RestaurantTable[]> {
    const rows = this.db
      .prepare('SELECT * FROM restaurant_tables WHERE restaurant_id = ? ORDER BY sort_order ASC, name ASC')
      .all(restaurantId) as any[];
    return rows.map((r) => this.mapToDomain(r));
  }

  async findById(id: string, restaurantId: string): Promise<RestaurantTable | null> {
    const row = this.db
      .prepare('SELECT * FROM restaurant_tables WHERE id = ? AND restaurant_id = ?')
      .get(id, restaurantId) as any;
    return row ? this.mapToDomain(row) : null;
  }

  async save(table: RestaurantTable): Promise<void> {
    const duplicate = this.db
      .prepare('SELECT id FROM restaurant_tables WHERE restaurant_id = ? AND lower(trim(name)) = lower(trim(?)) AND id != ?')
      .get(table.restaurantId, table.name, table.id);
    if (duplicate) {
      throw new ConflictError(`Ya existe una mesa llamada '${table.name}'.`);
    }
    this.db
      .prepare(`
        INSERT INTO restaurant_tables (id, restaurant_id, name, sort_order, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          sort_order = excluded.sort_order,
          is_active = excluded.is_active,
          updated_at = excluded.updated_at
        WHERE restaurant_tables.restaurant_id = excluded.restaurant_id
      `)
      .run(
        table.id,
        table.restaurantId,
        table.name,
        table.sortOrder,
        table.isActive ? 1 : 0,
        table.createdAt || new Date().toISOString(),
        table.updatedAt || new Date().toISOString()
      );
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    this.db.prepare('DELETE FROM restaurant_tables WHERE id = ? AND restaurant_id = ?').run(id, restaurantId);
  }
}
