import { ID_PREFIX, isValidId, newId } from '../../domain/shared/newId.js';
import { RestaurantTableRepository } from '../../domain/ports/out/RestaurantTableRepository.js';
import { MAX_TABLE_NAME_LENGTH, RestaurantTable } from '../../domain/models/RestaurantTable.js';
import { ValidationError } from '../../domain/errors/DomainErrors.js';

export interface CreateRestaurantTableInput {
  id?: string;
  name: string;
  isActive?: boolean;
}

/** Trims, collapses inner whitespace and validates a table name; shared by create and update. */
export function validateTableName(raw: string | undefined): string {
  const name = raw?.replace(/\s+/g, ' ').trim();
  if (!name) {
    throw new ValidationError('El nombre de la mesa es obligatorio');
  }
  if (name.length > MAX_TABLE_NAME_LENGTH) {
    throw new ValidationError(`El nombre de la mesa no puede superar ${MAX_TABLE_NAME_LENGTH} caracteres`);
  }
  return name;
}

export class CreateRestaurantTableUseCase {
  constructor(private tableRepo: RestaurantTableRepository) {}

  async execute(restaurantId: string, input: CreateRestaurantTableInput): Promise<RestaurantTable> {
    const name = validateTableName(input.name);
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
      name,
      sortOrder,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };

    await this.tableRepo.save(table);
    return table;
  }
}
