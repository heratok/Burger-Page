import { Database } from 'better-sqlite3';
import { Inventory } from '../../../domain/models/Inventory.js';
import { InventoryRepository } from '../../../domain/ports/out/InventoryRepository.js';
import { EntityNotFoundError, ValidationError } from '../../../domain/errors/DomainErrors.js';

export class SqliteInventoryRepository implements InventoryRepository {
  constructor(private db: Database) {}

  private mapToDomain(row: any): Inventory {
    const minAlert = Number(row.min_stock_alert ?? 5);
    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      name: row.name,
      category: row.category || 'ingredients',
      quantity: Number(row.current_stock ?? 0),
      unit: row.unit || 'unidades',
      minStockAlert: minAlert,
      alertThreshold: minAlert,
      costPerUnit: Number(row.cost_per_unit ?? 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findById(id: string, restaurantId: string): Promise<Inventory | null> {
    const row = this.db
      .prepare('SELECT * FROM inventory_items WHERE id = ? AND restaurant_id = ?')
      .get(id, restaurantId) as any;
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async findByRestaurantId(restaurantId: string): Promise<Inventory[]> {
    const rows = this.db
      .prepare('SELECT * FROM inventory_items WHERE restaurant_id = ? ORDER BY name ASC')
      .all(restaurantId) as any[];
    return rows.map((r) => this.mapToDomain(r));
  }

  async save(inventory: Inventory): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO inventory_items (id, restaurant_id, name, category, current_stock, min_stock_alert, unit, cost_per_unit, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        category = excluded.category,
        current_stock = excluded.current_stock,
        min_stock_alert = excluded.min_stock_alert,
        unit = excluded.unit,
        cost_per_unit = excluded.cost_per_unit,
        updated_at = excluded.updated_at
      WHERE inventory_items.restaurant_id = excluded.restaurant_id
    `);
    const minAlert = inventory.minStockAlert ?? inventory.alertThreshold ?? 5;
    stmt.run(
      inventory.id,
      inventory.restaurantId,
      inventory.name,
      inventory.category || 'ingredients',
      inventory.quantity,
      minAlert,
      inventory.unit || 'unidades',
      inventory.costPerUnit || 0,
      inventory.createdAt || new Date().toISOString(),
      inventory.updatedAt || new Date().toISOString()
    );
  }

  async adjustStock(id: string, restaurantId: string, delta: number): Promise<Inventory> {
    if (delta < 0) {
      const absDelta = Math.abs(delta);
      const result = this.db.prepare(`
        UPDATE inventory_items
        SET current_stock = current_stock + ?, updated_at = ?
        WHERE id = ? AND restaurant_id = ? AND current_stock >= ?
      `).run(delta, new Date().toISOString(), id, restaurantId, absDelta);

      if (result.changes === 0) {
        const item = await this.findById(id, restaurantId);
        if (!item) {
          throw new EntityNotFoundError(`Inventory item '${id}' not found for restaurant '${restaurantId}'.`);
        }
        throw new ValidationError(
          `Insufficient stock for item '${item.name}'. Current stock is ${item.quantity}, cannot reduce by ${absDelta}.`
        );
      }
    } else {
      const result = this.db.prepare(`
        UPDATE inventory_items
        SET current_stock = current_stock + ?, updated_at = ?
        WHERE id = ? AND restaurant_id = ?
      `).run(delta, new Date().toISOString(), id, restaurantId);

      if (result.changes === 0) {
        throw new EntityNotFoundError(`Inventory item '${id}' not found for restaurant '${restaurantId}'.`);
      }
    }

    const updated = await this.findById(id, restaurantId);
    if (!updated) {
      throw new EntityNotFoundError(`Inventory item '${id}' not found after adjustment.`);
    }
    return updated;
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    this.db
      .prepare('DELETE FROM inventory_items WHERE id = ? AND restaurant_id = ?')
      .run(id, restaurantId);
  }
}
