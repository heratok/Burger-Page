import { SupabaseClient } from '@supabase/supabase-js';
import { Inventory } from '../../../domain/models/Inventory.js';
import { InventoryRepository } from '../../../domain/ports/out/InventoryRepository.js';
import { EntityNotFoundError, ValidationError } from '../../../domain/errors/DomainErrors.js';

export class SupabaseInventoryRepository implements InventoryRepository {
  constructor(private client: SupabaseClient) {}

  private mapToDomain(row: any): Inventory {
    const minAlert = Number(row.min_stock_alert ?? row.alert_threshold ?? row.alertThreshold ?? 5);
    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      name: row.name,
      category: row.category || 'ingredients',
      quantity: Number(row.current_stock ?? row.quantity ?? 0),
      unit: row.unit || 'unidades',
      minStockAlert: minAlert,
      alertThreshold: minAlert,
      costPerUnit: Number(row.cost_per_unit ?? row.costPerUnit ?? 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findById(id: string, restaurantId: string): Promise<Inventory | null> {
    const { data, error } = await this.client
      .from('inventory_items')
      .select('*')
      .eq('id', id)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find inventory item by id: ${error.message}`);
    }
    if (!data) return null;
    return this.mapToDomain(data);
  }

  async findByRestaurantId(restaurantId: string): Promise<Inventory[]> {
    const { data, error } = await this.client
      .from('inventory_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to list inventory items: ${error.message}`);
    }
    return (data || []).map((row) => this.mapToDomain(row));
  }

  async save(inventory: Inventory): Promise<void> {
    const minAlert = inventory.minStockAlert ?? inventory.alertThreshold ?? 5;
    const payload = {
      id: inventory.id,
      restaurant_id: inventory.restaurantId,
      name: inventory.name,
      category: inventory.category || 'ingredients',
      current_stock: inventory.quantity,
      min_stock_alert: minAlert,
      unit: inventory.unit,
      cost_per_unit: inventory.costPerUnit || 0,
      updated_at: inventory.updatedAt || new Date().toISOString(),
    };

    const { error } = await this.client
      .from('inventory_items')
      .upsert(payload, { onConflict: 'id,restaurant_id' });

    if (error) {
      throw new Error(`Failed to save inventory: ${error.message}`);
    }
  }

  async adjustStock(id: string, restaurantId: string, delta: number): Promise<Inventory> {
    const { data, error } = await this.client.rpc('adjust_inventory_stock', {
      p_id: id,
      p_restaurant_id: restaurantId,
      p_delta: delta,
    });

    if (error) {
      throw new Error(`Failed to adjust inventory stock: ${error.message}`);
    }

    const rows = Array.isArray(data) ? data : (data ? [data] : []);
    if (rows.length === 0) {
      const existing = await this.findById(id, restaurantId);
      if (!existing) {
        throw new EntityNotFoundError(`Inventory item '${id}' not found for restaurant '${restaurantId}'.`);
      }
      throw new ValidationError(
        `Insufficient stock for item '${existing.name}'. Current stock is ${existing.quantity}, cannot reduce by ${Math.abs(delta)}.`
      );
    }

    return this.mapToDomain(rows[0]);
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    const { error } = await this.client
      .from('inventory_items')
      .delete()
      .eq('id', id)
      .eq('restaurant_id', restaurantId);

    if (error) {
      throw new Error(`Failed to delete inventory item: ${error.message}`);
    }
  }
}
