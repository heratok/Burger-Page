import { Database } from 'better-sqlite3';
import { Order, OrderStatus, OrderItem } from '../../../domain/models/Order.js';
import { UserRole } from '../../../domain/models/User.js';
import { OrderRepository } from '../../../domain/ports/out/OrderRepository.js';
import { ListOptions } from '../../../domain/ports/out/ListOptions.js';
import { EntityNotFoundError, InvalidOrderStateError } from '../../../domain/errors/DomainErrors.js';

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
        receipt_url TEXT,
        client_order_id TEXT,
        items TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    // Ensure columns exist for existing SQLite tables
    try {
      this.db.exec(`ALTER TABLE orders ADD COLUMN receipt_url TEXT;`);
    } catch {
      // Column already exists
    }
    try {
      this.db.exec(`ALTER TABLE orders ADD COLUMN customer TEXT;`);
    } catch {
      // Column already exists
    }
    try {
      this.db.exec(`ALTER TABLE orders ADD COLUMN client_order_id TEXT;`);
    } catch {
      // Column already exists
    }
    // SUS-19: unique (restaurant_id, client_order_id) so a retried save can
    // never insert a duplicate sale. SQLite UNIQUE treats NULLs as distinct,
    // so legacy/unknown flows (client_order_id IS NULL) stay unconstrained.
    this.db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_client_order_id
        ON orders (restaurant_id, client_order_id)
    `);
  }

  async findById(id: string, restaurantId: string): Promise<Order | null> {
    const row = this.db.prepare('SELECT * FROM orders WHERE id = ? AND restaurant_id = ?').get(id, restaurantId) as any;
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async findByRestaurantId(restaurantId: string, options?: ListOptions): Promise<Order[]> {
    const limit = options?.limit;
    let rows: any[];
    if (typeof limit === 'number' && Number.isInteger(limit) && limit > 0) {
      const page = options?.page && Number.isInteger(options.page) && options.page >= 1 ? options.page : 1;
      rows = this.db
        .prepare('SELECT * FROM orders WHERE restaurant_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
        .all(restaurantId, limit, (page - 1) * limit) as any[];
    } else {
      rows = this.db.prepare('SELECT * FROM orders WHERE restaurant_id = ? ORDER BY created_at DESC').all(restaurantId) as any[];
    }
    return rows.map((row) => this.mapToDomain(row));
  }

  async countByRestaurantId(restaurantId: string): Promise<number> {
    const row = this.db
      .prepare('SELECT COUNT(*) AS total FROM orders WHERE restaurant_id = ?')
      .get(restaurantId) as { total: number } | undefined;
    return Number(row?.total ?? 0);
  }

  async save(order: Order): Promise<void> {
    // SUS-19 idempotent replay: a retried save carrying the same
    // (restaurant_id, client_order_id) as an existing order returns the first
    // persisted order instead of inserting a duplicate sale.
    if (order.clientOrderId) {
      const existing = this.db
        .prepare('SELECT id, order_number FROM orders WHERE restaurant_id = ? AND client_order_id = ? LIMIT 1')
        .get(order.restaurantId, order.clientOrderId) as { id: string; order_number?: number } | undefined;
      if (existing) {
        // SUS-19 replay: adopt the originally persisted identity so the
        // returned order (and the HTTP response) references the real row.
        (order as any).id = existing.id;
        if (existing.order_number != null) {
          (order as any).orderNumber = existing.order_number;
        }
        return;
      }
    }
    const stmt = this.db.prepare(`
      INSERT INTO orders (
        id, restaurant_id, order_number, customer_id, status, total, delivery_fee, final_total,
        payment_method, payment_amount, change_amount, comment, receipt_url, client_order_id, items, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        total = excluded.total,
        delivery_fee = excluded.delivery_fee,
        final_total = excluded.final_total,
        payment_method = excluded.payment_method,
        payment_amount = excluded.payment_amount,
        change_amount = excluded.change_amount,
        comment = excluded.comment,
        receipt_url = excluded.receipt_url,
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
      order.receiptUrl || null,
      order.clientOrderId || null,
      JSON.stringify(order.items),
      order.createdAt.toISOString(),
      now
    );
  }

  async updateStatus(id: string, status: OrderStatus, restaurantId: string, _actorId?: string, _actorRole?: UserRole, expectedStatus?: OrderStatus): Promise<void> {
    // M1 CAS: the UPDATE only matches when the persisted status equals the
    // snapshot the domain validated (expectedStatus); a concurrent write that
    // moved the row first fails with a concurrency DomainError instead of
    // silently regressing the status (delivered -> cooking / cancel after delivery).
    const result = this.db
      .prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ? AND restaurant_id = ? AND (? IS NULL OR status = ?)')
      .run(status, new Date().toISOString(), id, restaurantId, expectedStatus ?? null, expectedStatus ?? null);

    if (result.changes === 0) {
      if (expectedStatus !== undefined && expectedStatus !== null) {
        throw new InvalidOrderStateError(`Order status changed concurrently for order ${id}`);
      }
      throw new EntityNotFoundError(`Order ${id} not found for restaurant ${restaurantId}`);
    }
  }

  async updateReceipt(id: string, receiptUrl: string, restaurantId: string): Promise<void> {
    const result = this.db.prepare('UPDATE orders SET receipt_url = ?, updated_at = ? WHERE id = ? AND restaurant_id = ?')
      .run(receiptUrl, new Date().toISOString(), id, restaurantId);

    if (result.changes === 0) {
      throw new EntityNotFoundError(`Order ${id} not found for restaurant ${restaurantId}`);
    }
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    const result = this.db.prepare('DELETE FROM orders WHERE id = ? AND restaurant_id = ?')
      .run(id, restaurantId);

    if (result.changes === 0) {
      throw new EntityNotFoundError(`Order ${id} not found for restaurant ${restaurantId}`);
    }
  }

  async update(order: Order, restaurantId: string): Promise<Order> {
    const existing = await this.findById(order.id, restaurantId);
    if (!existing) {
      throw new EntityNotFoundError(`Order ${order.id} not found for restaurant ${restaurantId}`);
    }

    const stmt = this.db.prepare(`
      UPDATE orders SET
        customer_id = ?,
        status = ?,
        total = ?,
        delivery_fee = ?,
        final_total = ?,
        payment_method = ?,
        payment_amount = ?,
        change_amount = ?,
        comment = ?,
        receipt_url = ?,
        items = ?,
        customer = ?,
        updated_at = ?
      WHERE id = ? AND restaurant_id = ?
    `);
    const now = new Date().toISOString();
    const customerPayload = order.customer
      ? JSON.stringify(order.customer)
      : (existing.customer ? JSON.stringify(existing.customer) : null);

    stmt.run(
      order.customerId || existing.customerId || null,
      order.status,
      order.subtotal,
      order.deliveryFee,
      order.finalTotal,
      order.paymentMethod,
      order.paymentAmount ?? null,
      order.changeAmount ?? null,
      order.comment ?? null,
      order.receiptUrl ?? null,
      JSON.stringify(order.items),
      customerPayload,
      now,
      order.id,
      restaurantId
    );

    return (await this.findById(order.id, restaurantId)) || order;
  }

  private mapToDomain(row: any): Order {
    const items: OrderItem[] = JSON.parse(row.items || '[]');
    const order = new Order(
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
      row.comment || undefined,
      row.receipt_url || undefined,
      row.client_order_id || undefined
    );
    if (row.customer) {
      try {
        order.customer = JSON.parse(row.customer);
      } catch {
        order.customer = row.customer;
      }
    }
    return order;
  }
}
