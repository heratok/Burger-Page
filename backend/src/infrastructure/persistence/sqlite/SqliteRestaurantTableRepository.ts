import { Database } from 'better-sqlite3';
import { RestaurantTable, duplicateTableMessage, tableIdentityKey } from '../../../domain/models/RestaurantTable.js';
import { RestaurantTableRepository } from '../../../domain/ports/out/RestaurantTableRepository.js';
import { ConflictError } from '../../../domain/errors/DomainErrors.js';

export class SqliteRestaurantTableRepository implements RestaurantTableRepository {
  constructor(private db: Database) {}

  private mapToDomain(row: any): RestaurantTable {
    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      zone: row.zone,
      number: Number(row.number),
      alias: row.alias ?? null,
      name: row.name,
      sortOrder: Number(row.sort_order ?? 0),
      isActive: Boolean(row.is_active),
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    };
  }

  async findByRestaurantId(restaurantId: string): Promise<RestaurantTable[]> {
    const rows = this.db
      .prepare('SELECT * FROM restaurant_tables WHERE restaurant_id = ?')
      .all(restaurantId) as any[];
    // Zone is compared in JS: SQLite lower() only folds ASCII.
    return rows
      .map((r) => this.mapToDomain(r))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.zone.toLowerCase().localeCompare(b.zone.toLowerCase()) || a.number - b.number);
  }

  async findById(id: string, restaurantId: string): Promise<RestaurantTable | null> {
    const row = this.db
      .prepare('SELECT * FROM restaurant_tables WHERE id = ? AND restaurant_id = ?')
      .get(id, restaurantId) as any;
    return row ? this.mapToDomain(row) : null;
  }

  private assertFree(table: RestaurantTable): void {
    const sameNumber = this.db
      .prepare('SELECT zone FROM restaurant_tables WHERE restaurant_id = ? AND number = ? AND id != ?')
      .all(table.restaurantId, table.number, table.id) as Array<{ zone: string }>;
    const wanted = tableIdentityKey(table.zone, table.number);
    if (sameNumber.some((r) => tableIdentityKey(r.zone, table.number) === wanted)) {
      throw new ConflictError(duplicateTableMessage(table));
    }
  }

  private upsert(table: RestaurantTable): void {
    this.assertFree(table);
    this.db
      .prepare(`
        INSERT INTO restaurant_tables (id, restaurant_id, name, zone, number, alias, sort_order, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          zone = excluded.zone,
          number = excluded.number,
          alias = excluded.alias,
          sort_order = excluded.sort_order,
          is_active = excluded.is_active,
          updated_at = excluded.updated_at
        WHERE restaurant_tables.restaurant_id = excluded.restaurant_id
      `)
      .run(
        table.id,
        table.restaurantId,
        table.name,
        table.zone,
        table.number,
        table.alias,
        table.sortOrder,
        table.isActive ? 1 : 0,
        table.createdAt || new Date().toISOString(),
        table.updatedAt || new Date().toISOString()
      );
  }

  async save(table: RestaurantTable): Promise<void> {
    this.upsert(table);
  }

  async saveMany(tables: RestaurantTable[]): Promise<void> {
    this.db.transaction(() => {
      for (const table of tables) this.upsert(table);
    })();
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    this.db.prepare('DELETE FROM restaurant_tables WHERE id = ? AND restaurant_id = ?').run(id, restaurantId);
  }
}
