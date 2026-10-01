import { Supplier } from '../../../domain/models/Supplier.js';
import { SupplierRepository } from '../../../domain/ports/out/SupplierRepository.js';
import { withTenantContext } from './PgClient.js';

function mapRow(row: any): Supplier {
  return {
    id: row.id,
    restaurantId: row.restaurant_id || row.restaurantId,
    name: row.name,
    category: row.category || 'general',
    contactName: row.contact_name || row.contactName || '',
    phone: row.phone || '',
    email: row.email || undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  };
}

export class PgSupplierRepository implements SupplierRepository {
  async findById(id: string, restaurantId: string): Promise<Supplier | null> {
    return withTenantContext({ restaurantId }, async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM public.suppliers WHERE id = $1 AND restaurant_id = $2`,
        [id, restaurantId]
      );
      return rows[0] ? mapRow(rows[0]) : null;
    });
  }

  async findByRestaurantId(restaurantId: string): Promise<Supplier[]> {
    return withTenantContext({ restaurantId }, async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM public.suppliers WHERE restaurant_id = $1 ORDER BY name ASC`,
        [restaurantId]
      );
      return rows.map(mapRow);
    });
  }

  async save(supplier: Supplier): Promise<void> {
    await withTenantContext({ restaurantId: supplier.restaurantId }, async (client) => {
      await client.query(
        `INSERT INTO public.suppliers (id, restaurant_id, name, category, contact_name, phone, email, notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::timestamptz, NOW()), NOW())
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           category = EXCLUDED.category,
           contact_name = EXCLUDED.contact_name,
           phone = EXCLUDED.phone,
           email = EXCLUDED.email,
           notes = EXCLUDED.notes,
           updated_at = NOW()`,
        [
          supplier.id,
          supplier.restaurantId,
          supplier.name,
          supplier.category || 'general',
          // Empty optional text is stored as NULL (db-hardening-0008).
          supplier.contactName || null,
          supplier.phone || null,
          supplier.email || null,
          supplier.notes || null,
          supplier.createdAt || null,
        ]
      );
    });
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    await withTenantContext({ restaurantId }, async (client) => {
      await client.query(
        `DELETE FROM public.suppliers WHERE id = $1 AND restaurant_id = $2`,
        [id, restaurantId]
      );
    });
  }
}
