import { Database } from 'better-sqlite3';
import { Order, OrderStatus, OrderItem } from '../../../domain/models/Order.js';
import { OrderRepository } from '../../../domain/ports/out/OrderRepository.js';

export class SqliteOrderRepository implements OrderRepository {
  constructor(private db: Database) {}

  async findById(id: string): Promise<Order | null> {
    const row = this.db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async findAll(): Promise<Order[]> {
    const rows = this.db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all() as any[];
    return rows.map(row => this.mapToDomain(row));
  }

  async save(order: Order): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO orders (id, order_number, customer_id, status, total, delivery_fee, final_total, items, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        total = excluded.total,
        delivery_fee = excluded.delivery_fee,
        final_total = excluded.final_total,
        items = excluded.items,
        updated_at = excluded.updated_at
    `);
    const now = new Date().toISOString();
    stmt.run(
      order.id,
      Date.now() % 100000,
      order.customerId,
      order.status,
      order.subtotal,
      order.deliveryFee,
      order.total,
      JSON.stringify(order.items),
      order.createdAt.toISOString(),
      now
    );
  }

  private mapToDomain(row: any): Order {
    const items: OrderItem[] = JSON.parse(row.items || '[]');
    return new Order(
      row.id,
      row.customer_id,
      items,
      row.status as OrderStatus,
      new Date(row.created_at),
      row.delivery_fee || 0
    );
  }
}
