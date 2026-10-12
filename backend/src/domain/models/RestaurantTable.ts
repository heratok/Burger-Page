import { formatTableName, normalizeTableZone } from '@burger-page/contracts';

/**
 * A dine-in table a restaurant owner manages and a "Mesa / Salón" sale selects.
 * Identified by (zone, number) within its restaurant; `name` is always derived
 * ("<zone> <number>" or "<zone> <number> · <alias>") and never set by clients.
 */
export interface RestaurantTable {
  id: string;
  restaurantId: string;
  zone: string;
  number: number;
  alias: string | null;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Case- and spacing-insensitive identity of a table inside its restaurant. */
export const tableIdentityKey = (zone: string, number: number): string =>
  `${normalizeTableZone(zone).toLowerCase()}#${number}`;

/** Spanish conflict message shared by the three repositories. */
export const duplicateTableMessage = (table: Pick<RestaurantTable, 'zone' | 'number'>): string =>
  `Ya existe la mesa '${formatTableName({ zone: table.zone, number: table.number })}'`;
