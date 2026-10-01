import { RestaurantTableRepository } from '../../domain/ports/out/RestaurantTableRepository.js';
import { RestaurantTable } from '../../domain/models/RestaurantTable.js';
import { ValidationError } from '../../domain/errors/DomainErrors.js';

export class ReorderRestaurantTablesUseCase {
  constructor(private tableRepo: RestaurantTableRepository) {}

  /**
   * Places the given tables first, in that order; tables not listed keep their
   * relative order after them. Every id must be a distinct table of the restaurant.
   */
  async execute(restaurantId: string, orderedIds: string[]): Promise<RestaurantTable[]> {
    const current = await this.tableRepo.findByRestaurantId(restaurantId);
    const byId = new Map(current.map((t) => [t.id, t]));

    if (new Set(orderedIds).size !== orderedIds.length) {
      throw new ValidationError('Table ids must not repeat');
    }
    for (const id of orderedIds) {
      if (!byId.has(id)) {
        throw new ValidationError(`Table "${id}" does not belong to this restaurant`);
      }
    }

    const listed = new Set(orderedIds);
    const sequence = [...orderedIds.map((id) => byId.get(id)!), ...current.filter((t) => !listed.has(t.id))];

    const now = new Date().toISOString();
    const result: RestaurantTable[] = [];
    for (const [index, table] of sequence.entries()) {
      if (table.sortOrder === index) {
        result.push(table);
        continue;
      }
      const moved = { ...table, sortOrder: index, updatedAt: now };
      await this.tableRepo.save(moved);
      result.push(moved);
    }
    return result;
  }
}
