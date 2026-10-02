import { RestaurantTableRepository } from '../../domain/ports/out/RestaurantTableRepository.js';
import { RestaurantTable } from '../../domain/models/RestaurantTable.js';
import { ConflictError } from '../../domain/errors/DomainErrors.js';

export const normalizeTableName = (name: string): string => name.replace(/\s+/g, ' ').trim().toLowerCase();

export class InMemoryRestaurantTableRepository implements RestaurantTableRepository {
  private tables: Map<string, RestaurantTable> = new Map();

  constructor(initial: RestaurantTable[] = []) {
    for (const t of initial) this.tables.set(t.id, { ...t });
  }

  async findByRestaurantId(restaurantId: string): Promise<RestaurantTable[]> {
    return Array.from(this.tables.values())
      .filter((t) => t.restaurantId === restaurantId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map((t) => ({ ...t }));
  }

  async findById(id: string, restaurantId: string): Promise<RestaurantTable | null> {
    const t = this.tables.get(id);
    if (!t || t.restaurantId !== restaurantId) return null;
    return { ...t };
  }

  async save(table: RestaurantTable): Promise<void> {
    const wanted = normalizeTableName(table.name);
    const duplicate = Array.from(this.tables.values()).some(
      (t) => t.restaurantId === table.restaurantId && t.id !== table.id && normalizeTableName(t.name) === wanted
    );
    if (duplicate) {
      throw new ConflictError(`Ya existe una mesa llamada '${table.name}'.`);
    }
    this.tables.set(table.id, { ...table });
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    const t = this.tables.get(id);
    if (t && t.restaurantId === restaurantId) this.tables.delete(id);
  }
}
