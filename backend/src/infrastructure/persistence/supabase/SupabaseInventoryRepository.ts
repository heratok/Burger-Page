import { SupabaseClient } from '@supabase/supabase-js';
import { Inventory } from '../../../domain/models/Inventory.js';
import { InventoryRepository } from '../../../domain/ports/out/InventoryRepository.js';

export class SupabaseInventoryRepository implements InventoryRepository {
  constructor(private client: SupabaseClient) {}

  private mapToDomain(row: any): Inventory {
    const alert = Number(row.min_stock_alert ?? row.alert_threshold ?? row.alertThreshold ?? 0);
    return {
      id: row.id,
      name: row.name,
      category: row.category || 'ingredients',
      quantity: Number(row.current_stock ?? row.quantity ?? 0),
      unit: row.unit || 'units',
      alertThreshold: alert,
      minStockAlert: alert,
      costPerUnit: Number(row.cost_per_unit ?? row.costPerUnit ?? 0)
    };
  }

  async findById(id: string): Promise<Inventory | null> {
    const { data, error } = await this.client
      .from('inventory')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find inventory item by id: ${error.message}`);
    }
    if (!data) return null;
    return this.mapToDomain(data);
  }

  async findAll(): Promise<Inventory[]> {
    const { data, error } = await this.client
      .from('inventory')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to list inventory items: ${error.message}`);
    }
    return (data || []).map((row) => this.mapToDomain(row));
  }

  async save(inventory: Inventory): Promise<void> {
    const minAlert = inventory.minStockAlert ?? inventory.alertThreshold ?? 0;
    const payload = {
      id: inventory.id,
      name: inventory.name,
      category: inventory.category || 'ingredients',
      current_stock: inventory.quantity,
      min_stock_alert: minAlert,
      unit: inventory.unit,
      cost_per_unit: inventory.costPerUnit || 0
    };

    const { error } = await this.client
      .from('inventory')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      throw new Error(`Failed to save inventory: ${error.message}`);
    }
  }
}
