import { Database } from 'better-sqlite3';
import { Order, OrderStatus, OrderItem } from '../../../domain/models/Order.js';
import { OrderRepository } from '../../../domain/ports/out/OrderRepository.js';

export class SqliteOrderRepository implements OrderRepository {
  constructor(private db: Database) {
    this.ensureSchema();
  }

  private ensureSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        order_number INTEGER,
        customer_id TEXT,
        status TEXT NOT NULL,
        total REAL NOT NULL,
        delivery_fee REAL NOT NULL,
        final_total REAL NOT NULL,
        payment_method TEXT DEFAULT 'Efectivo',
        payment_amount REAL,
        change_amount REAL,
        comment TEXT,
        items TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  }

  async findById(id: string, restaurantId: string): Promise<Order | null> {
    const row = this.db.prepare('SELECT * FROM orders WHERE id = ? AND restaurant_id = ?').get(id, restaurantId) as any;
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async findByRestaurantId(restaurantId: string): Promise<Order[]> {
    const rows = this.db.prepare('SELECT * FROM orders WHERE restaurant_id = ? ORDER BY created_at DESC').all(restaurantId) as any[];
    return rows.map((row) => this.mapToDomain(row));
  }

  async save(order: Order): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO orders (
        id, restaurant_id, order_number, customer_id, status, total, delivery_fee, final_total,
        payment_method, payment_amount, change_amount, comment, items, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        total = excluded.total,
        delivery_fee = excluded.delivery_fee,
        final_total = excluded.final_total,
        payment_method = excluded.payment_method,
        payment_amount = excluded.payment_amount,
        change_amount = excluded.change_amount,
        comment = excluded.comment,
        items = excluded.items,
        updated_at = excluded.updated_at
    `);
    const now = new Date().toISOString();
    stmt.run(
      order.id,
      order.restaurantId,
      order.orderNumber || (Date.now() % 100000),
      order.customerId || null,
      order.status,
      order.subtotal,
      order.deliveryFee,
      order.finalTotal,
      order.paymentMethod,
      order.paymentAmount || null,
      order.changeAmount || null,
      order.comment || null,
      JSON.stringify(order.items),
      order.createdAt.toISOString(),
      now
    );
  }

  async updateStatus(id: string, status: OrderStatus, restaurantId: string, _actorId?: string): Promise<void> {
    const result = this.db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ? AND restaurant_id = ?')
      .run(status, new Date().toISOString(), id, restaurantId);

    if (result.changes === 0) {
      throw new Error(`Order ${id} not found for restaurant ${restaurantId}`);
    }
  }

  private mapToDomain(row: any): Order {
    const items: OrderItem[] = JSON.parse(row.items || '[]');
    return new Order(
      row.id,
      row.restaurant_id,
      row.customer_id || undefined,
      items,
      row.status as OrderStatus,
      new Date(row.created_at),
      row.delivery_fee || 0,
      row.order_number,
      row.payment_method || 'Efectivo',
      row.payment_amount !== null ? Number(row.payment_amount) : undefined,
      row.change_amount !== null ? Number(row.change_amount) : undefined,
      row.comment || undefined
    );
  }
}
