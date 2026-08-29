import { Database } from 'better-sqlite3';
import { Customer } from '../../../domain/models/Customer.js';
import { CustomerRepository } from '../../../domain/ports/out/CustomerRepository.js';

export class SqliteCustomerRepository implements CustomerRepository {
  constructor(private db: Database) {}

  async findById(id: string): Promise<Customer | null> {
    const row = this.db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async findAll(): Promise<Customer[]> {
    const rows = this.db.prepare('SELECT * FROM customers').all() as any[];
    return rows.map(row => this.mapToDomain(row));
  }

  async save(customer: Customer): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO customers (id, name, email, phone, address, total_orders, total_spent, loyalty_tier, last_order_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        email = excluded.email,
        phone = excluded.phone,
        address = excluded.address,
        total_orders = excluded.total_orders,
        total_spent = excluded.total_spent,
        loyalty_tier = excluded.loyalty_tier,
        last_order_date = excluded.last_order_date
    `);
    stmt.run(
      customer.id,
      customer.name,
      customer.email,
      customer.phone,
      '',
      customer.totalOrders,
      customer.totalSpent,
      customer.loyaltyTier,
      new Date().toISOString()
    );
  }

  private mapToDomain(row: any): Customer {
    return new Customer(
      row.id,
      row.name,
      row.email || '',
      row.phone || '',
      Number(row.total_spent ?? 0),
      Number(row.total_orders ?? 0)
    );
  }
}
