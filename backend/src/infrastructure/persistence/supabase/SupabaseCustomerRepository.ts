import { SupabaseClient } from '@supabase/supabase-js';
import { Customer } from '../../../domain/models/Customer.js';
import { CustomerRepository } from '../../../domain/ports/out/CustomerRepository.js';

export class SupabaseCustomerRepository implements CustomerRepository {
  constructor(private client: SupabaseClient) {}

  private mapToDomain(row: any): Customer {
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

  async findById(id: string, restaurantId: string): Promise<Customer | null> {
    const { data, error } = await this.client
      .from('customers')
      .select('*')
      .eq('id', id)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find customer by id: ${error.message}`);
    }
    if (!data) return null;
    return this.mapToDomain(data);
  }

  async findByRestaurantId(restaurantId: string): Promise<Customer[]> {
    const { data, error } = await this.client
      .from('customers')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to list customers: ${error.message}`);
    }
    return (data || []).map((row) => this.mapToDomain(row));
  }

  async findByPhone(phone: string, restaurantId: string): Promise<Customer | null> {
    const { data, error } = await this.client
      .from('customers')
      .select('*')
      .eq('phone', phone)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find customer by phone: ${error.message}`);
    }
    if (!data) return null;
    return this.mapToDomain(data);
  }

  async save(customer: Customer): Promise<void> {
    const payload = {
      id: customer.id,
      restaurant_id: customer.restaurantId,
      name: customer.name,
      phone: customer.phone,
      address: customer.address || '',
      barrio: customer.barrio || '',
      notes: customer.notes || '',
      email: customer.email || '',
      updated_at: customer.updatedAt || new Date().toISOString(),
    };

    const { error } = await this.client
      .from('customers')
      .upsert(payload, { onConflict: 'id,restaurant_id' });

    if (error) {
      throw new Error(`Failed to save customer: ${error.message}`);
    }
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    const { error } = await this.client
      .from('customers')
      .delete()
      .eq('id', id)
      .eq('restaurant_id', restaurantId);

    if (error) {
      throw new Error(`Failed to delete customer: ${error.message}`);
    }
  }
}
