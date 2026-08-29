import { Database } from 'better-sqlite3';
import { Inventory } from '../../../domain/models/Inventory.js';
import { InventoryRepository } from '../../../domain/ports/out/InventoryRepository.js';

export class SqliteInventoryRepository implements InventoryRepository {
  constructor(private db: Database) {}

  async findById(id: string): Promise<Inventory | null> {
    const row = this.db.prepare('SELECT * FROM inventory WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async findAll(): Promise<Inventory[]> {
    const rows = this.db.prepare('SELECT * FROM inventory').all() as any[];
    return rows.map(row => this.mapToDomain(row));
  }

  async save(inventory: Inventory): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO inventory (id, name, category, current_stock, min_stock_alert, unit, cost_per_unit)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        category = excluded.category,
        current_stock = excluded.current_stock,
        min_stock_alert = excluded.min_stock_alert,
        unit = excluded.unit,
        cost_per_unit = excluded.cost_per_unit
    `);
    const minAlert = inventory.minStockAlert ?? inventory.alertThreshold ?? 0;
    stmt.run(
      inventory.id,
      inventory.name,
      inventory.category || 'ingredients',
      inventory.quantity,
      minAlert,
      inventory.unit,
      inventory.costPerUnit || 0
    );
  }

  private mapToDomain(row: any): Inventory {
    const minAlert = Number(row.min_stock_alert ?? 0);
    return {
      id: row.id,
      name: row.name,
      category: row.category || 'ingredients',
      quantity: Number(row.current_stock ?? 0),
      unit: row.unit,
      alertThreshold: minAlert,
      minStockAlert: minAlert,
      costPerUnit: Number(row.cost_per_unit ?? 0),
    };
  }
}
