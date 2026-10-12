import { RestaurantTableRepository } from '../../domain/ports/out/RestaurantTableRepository.js';
import { RestaurantTable, duplicateTableMessage, tableIdentityKey } from '../../domain/models/RestaurantTable.js';
import { ConflictError } from '../../domain/errors/DomainErrors.js';

export class InMemoryRestaurantTableRepository implements RestaurantTableRepository {
  private tables: Map<string, RestaurantTable> = new Map();

  constructor(initial: RestaurantTable[] = []) {
    for (const t of initial) this.tables.set(t.id, { ...t });
  }

  async findByRestaurantId(restaurantId: string): Promise<RestaurantTable[]> {
    return Array.from(this.tables.values())
      .filter((t) => t.restaurantId === restaurantId)
      .sort(
        (a, b) =>
          a.sortOrder - b.sortOrder ||
          a.zone.toLowerCase().localeCompare(b.zone.toLowerCase()) ||
          a.number - b.number
      )
      .map((t) => ({ ...t }));
  }

  async findById(id: string, restaurantId: string): Promise<RestaurantTable | null> {
    const t = this.tables.get(id);
    if (!t || t.restaurantId !== restaurantId) return null;
    return { ...t };
  }

  private assertFree(table: RestaurantTable, extra: RestaurantTable[] = []): void {
    const wanted = tableIdentityKey(table.zone, table.number);
    const taken = [...this.tables.values(), ...extra].some(
      (t) => t.restaurantId === table.restaurantId && t.id !== table.id && tableIdentityKey(t.zone, t.number) === wanted
    );
    if (taken) {
      throw new ConflictError(duplicateTableMessage(table));
    }
  }

  async save(table: RestaurantTable): Promise<void> {
    this.assertFree(table);
    this.tables.set(table.id, { ...table });
  }

  async saveMany(tables: RestaurantTable[]): Promise<void> {
    tables.forEach((table, index) => this.assertFree(table, tables.slice(0, index)));
    for (const table of tables) this.tables.set(table.id, { ...table });
  }

  async delete(id: string, restaurantId: string): Promise<void> {
    const t = this.tables.get(id);
    if (t && t.restaurantId === restaurantId) this.tables.delete(id);
  }
}
