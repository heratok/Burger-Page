import { SupabaseClient } from '@supabase/supabase-js';
import { Customer } from '../../../domain/models/Customer.js';
import { CustomerRepository } from '../../../domain/ports/out/CustomerRepository.js';

export class SupabaseCustomerRepository implements CustomerRepository {
  constructor(private client: SupabaseClient) {}

  private mapToDomain(row: any): Customer {
    return new Customer(
      row.id,
      row.name,
      row.email || '',
      row.phone || '',
      Number(row.total_spent ?? row.total_spend ?? 0),
      Number(row.total_orders ?? row.totalOrders ?? 0)
    );
  }

  async findById(id: string): Promise<Customer | null> {
    const { data, error } = await this.client
      .from('customers')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find customer by id: ${error.message}`);
    }
    if (!data) return null;
    return this.mapToDomain(data);
  }

  async findAll(): Promise<Customer[]> {
    const { data, error } = await this.client
      .from('customers')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to list customers: ${error.message}`);
    }
    return (data || []).map((row) => this.mapToDomain(row));
  }

  async save(customer: Customer): Promise<void> {
    const payload = {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: '',
      total_orders: customer.totalOrders,
      total_spent: customer.totalSpent,
      loyalty_tier: customer.loyaltyTier,
      last_order_date: new Date().toISOString()
    };

    const { error } = await this.client
      .from('customers')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      throw new Error(`Failed to save customer: ${error.message}`);
    }
  }
}
