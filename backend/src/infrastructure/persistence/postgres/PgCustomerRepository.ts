import { Customer } from '../../../domain/models/Customer.js';
import { CustomerRepository } from '../../../domain/ports/out/CustomerRepository.js';
import { withTenantContext } from './PgClient.js';

function mapRow(row: any): Customer {
  return new Customer(
    row.id,
    row.restaurant_id,
    row.name,
    row.phone || '',
    row.address || '',
    row.barrio || '',
    row.notes || '',
    row.email || '',
    row.created_at,
    row.updated_at
  );
}

export class PgCustomerRepository implements CustomerRepository {
  async findById(id: string, restaurantId: string): Promise<Customer | null> {
    return withTenantContext({ restaurantId }, async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM public.customers WHERE id = $1 AND restaurant_id = $2`,
        [id, restaurantId]
      );
      return rows[0] ? mapRow(rows[0]) : null;
    });
  }

  async findByRestaurantId(restaurantId: string): Promise<Customer[]> {
    return withTenantContext({ restaurantId }, async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM public.customers WHERE restaurant_id = $1 ORDER BY name ASC`,
        [restaurantId]
      );
      return rows.map(mapRow);
    });
  }

  async findByPhone(phone: string, restaurantId: string): Promise<Customer | null> {
    return withTenantContext({ restaurantId }, async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM public.customers WHERE phone = $1 AND restaurant_id = $2`,
        [phone, restaurantId]
      );
      return rows[0] ? mapRow(rows[0]) : null;
    });
  }

  async save(customer: Customer): Promise<void> {
    await withTenantContext({ restaurantId: customer.restaurantId }, async (client) => {
      await client.query(
        `INSERT INTO public.customers (id, restaurant_id, name, phone, address, barrio, notes, email, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           phone = EXCLUDED.phone,
           address = EXCLUDED.address,
           barrio = EXCLUDED.barrio,
           notes = EXCLUDED.notes,
           email = EXCLUDED.email,
           updated_at = NOW()`,
        [
          customer.id,
          customer.restaurantId,
          customer.name,
          customer.phone,
          customer.address || '',
          customer.barrio || '',
          customer.notes || '',
          customer.email || '',
        ]
      );
    });
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    await withTenantContext({ restaurantId }, async (client) => {
      await client.query(`DELETE FROM public.customers WHERE id = $1 AND restaurant_id = $2`, [id, restaurantId]);
    });
  }
}
