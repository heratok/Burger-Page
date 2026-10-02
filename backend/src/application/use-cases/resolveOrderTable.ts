import { RestaurantTable } from '../../domain/models/RestaurantTable.js';
import { RestaurantTableRepository } from '../../domain/ports/out/RestaurantTableRepository.js';
import { ValidationError } from '../../domain/errors/DomainErrors.js';

/**
 * Resolves the table a staff sale is taken on. The table must exist in the
 * order's restaurant (a table of another tenant is indistinguishable from a
 * missing one) and be active. Throws ValidationError otherwise.
 */
export async function resolveOrderTable(
  tableRepo: RestaurantTableRepository | undefined,
  tableId: string,
  restaurantId: string
): Promise<RestaurantTable> {
  if (!tableRepo) {
    throw new ValidationError('Las mesas no están disponibles para este restaurante.');
  }
  const table = await tableRepo.findById(tableId, restaurantId);
  if (!table || table.restaurantId !== restaurantId) {
    throw new ValidationError('La mesa seleccionada no existe en este restaurante.');
  }
  if (!table.isActive) {
    throw new ValidationError(`La mesa '${table.name}' está desactivada.`);
  }
  return table;
}
