export type InventoryCategory = 'ingredients' | 'beverages' | 'packaging' | 'cleaning' | 'other';
export type InventoryUnit = 'unidades' | 'kg' | 'g' | 'litros' | 'paquetes' | 'cajas';

export interface Inventory {
  id: string;
  restaurantId: string;
  name: string;
  category: InventoryCategory;
  quantity: number;
  unit: InventoryUnit;
  minStockAlert: number;
  alertThreshold: number;
  costPerUnit: number;
  createdAt?: string;
  updatedAt?: string;
}
