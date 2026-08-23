import { Database } from 'better-sqlite3';
import { Inventory } from '../../../domain/models/Inventory.js';
import { InventoryRepository } from '../../../domain/ports/out/InventoryRepository.js';

export class SqliteInventoryRepository implements InventoryRepository {
  constructor(private db: Database) {}

  async findById(id: string): Promise<Inventory | null> {
    const row = this.db.prepare('SELECT * FROM inventory WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      quantity: row.current_stock,
      unit: row.unit,
      alertThreshold: row.min_stock_alert
    };
  }

  async findAll(): Promise<Inventory[]> {
    const rows = this.db.prepare('SELECT * FROM inventory').all() as any[];
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      quantity: row.current_stock,
      unit: row.unit,
      alertThreshold: row.min_stock_alert
    }));
  }

  async save(inventory: Inventory): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO inventory (id, name, category, current_stock, min_stock_alert, unit, cost_per_unit)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        current_stock = excluded.current_stock,
        min_stock_alert = excluded.min_stock_alert,
        unit = excluded.unit
    `);
    stmt.run(
      inventory.id,
      inventory.name,
      'ingredients',
      inventory.quantity,
      inventory.alertThreshold,
      inventory.unit,
      0
    );
  }
}
