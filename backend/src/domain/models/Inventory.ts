export interface Inventory {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  alertThreshold: number;
  category?: string;
  costPerUnit?: number;
  minStockAlert?: number;
}
