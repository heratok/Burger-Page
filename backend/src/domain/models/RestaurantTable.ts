/** A dine-in table a restaurant owner manages and a "Mesa / Salón" sale selects. */
export interface RestaurantTable {
  id: string;
  restaurantId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Same limit as the chk_restaurant_tables_name CHECK. */
export const MAX_TABLE_NAME_LENGTH = 40;
