import { ID_PREFIX, isValidId, newId } from '../../domain/shared/newId.js';
import { RestaurantTableRepository } from '../../domain/ports/out/RestaurantTableRepository.js';
import { RestaurantTable } from '../../domain/models/RestaurantTable.js';
import { ValidationError } from '../../domain/errors/DomainErrors.js';
import { buildTableIdentity } from './tableIdentity.js';

export interface CreateRestaurantTableInput {
  id?: string;
  zone: string;
  number: number;
  alias?: string | null;
  isActive?: boolean;
}

export class CreateRestaurantTableUseCase {
  constructor(private tableRepo: RestaurantTableRepository) {}

  async execute(restaurantId: string, input: CreateRestaurantTableInput): Promise<RestaurantTable> {
    const identity = buildTableIdentity(input);
    if (input.id !== undefined && !isValidId(input.id)) {
      throw new ValidationError('El id de la mesa debe tener de 1 a 64 caracteres: letras, dígitos, "_" o "-"');
    }

    // New tables go to the end of the list.
    const existing = await this.tableRepo.findByRestaurantId(restaurantId);
    const sortOrder = existing.reduce((max, t) => Math.max(max, t.sortOrder), -1) + 1;

    const now = new Date().toISOString();
    const table: RestaurantTable = {
      id: input.id ?? newId(ID_PREFIX.table),
      restaurantId,
      ...identity,
      sortOrder,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };

    await this.tableRepo.save(table);
    return table;
  }
}
