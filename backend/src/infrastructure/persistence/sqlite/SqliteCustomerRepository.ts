import { Database } from 'better-sqlite3';
import { Customer } from '../../../domain/models/Customer.js';
import { CustomerRepository } from '../../../domain/ports/out/CustomerRepository.js';

export class SqliteCustomerRepository implements CustomerRepository {
  constructor(private db: Database) {}

  private mapToDomain(row: any): Customer {
    return new Customer(
      row.id,
      row.restaurant_id,
      row.name,
      row.phone,
      row.address || '',
      row.barrio || '',
      row.notes || '',
      row.email || '',
      row.created_at,
      row.updated_at
    );
  }

  async findById(id: string, restaurantId: string): Promise<Customer | null> {
    const row = this.db
      .prepare('SELECT * FROM customers WHERE id = ? AND restaurant_id = ?')
      .get(id, restaurantId) as any;
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async findByRestaurantId(restaurantId: string): Promise<Customer[]> {
    const rows = this.db
      .prepare('SELECT * FROM customers WHERE restaurant_id = ? ORDER BY name ASC')
      .all(restaurantId) as any[];
    return rows.map((r) => this.mapToDomain(r));
  }

  async findByPhone(phone: string, restaurantId: string): Promise<Customer | null> {
    const row = this.db
      .prepare('SELECT * FROM customers WHERE phone = ? AND restaurant_id = ?')
      .get(phone, restaurantId) as any;
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async save(customer: Customer): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO customers (id, restaurant_id, name, phone, address, barrio, notes, email, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        phone = excluded.phone,
        address = excluded.address,
        barrio = excluded.barrio,
        notes = excluded.notes,
        email = excluded.email,
        updated_at = excluded.updated_at
      WHERE customers.restaurant_id = excluded.restaurant_id
    `);
    stmt.run(
      customer.id,
      customer.restaurantId,
      customer.name,
      customer.phone,
      customer.address || '',
      customer.barrio || '',
      customer.notes || '',
      customer.email || '',
      customer.createdAt || new Date().toISOString(),
      customer.updatedAt || new Date().toISOString()
    );
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    this.db
      .prepare('DELETE FROM customers WHERE id = ? AND restaurant_id = ?')
      .run(id, restaurantId);
  }
}
