import { RestaurantTableRepository } from '../../domain/ports/out/RestaurantTableRepository.js';
import { RestaurantTable } from '../../domain/models/RestaurantTable.js';
import { EntityNotFoundError } from '../../domain/errors/DomainErrors.js';
import { buildTableIdentity } from './tableIdentity.js';

export interface UpdateRestaurantTableInput {
  zone?: string;
  number?: number;
  /** undefined keeps the current alias; null (or blank) clears it. */
  alias?: string | null;
  isActive?: boolean;
}

export class UpdateRestaurantTableUseCase {
  constructor(private tableRepo: RestaurantTableRepository) {}

  async execute(id: string, restaurantId: string, input: UpdateRestaurantTableInput): Promise<RestaurantTable> {
    const existing = await this.tableRepo.findById(id, restaurantId);
    if (!existing) {
      throw new EntityNotFoundError('Mesa no encontrada.');
    }

    const identity = buildTableIdentity({
      zone: input.zone !== undefined ? input.zone : existing.zone,
      number: input.number !== undefined ? input.number : existing.number,
      alias: input.alias !== undefined ? input.alias : existing.alias,
    });

    const updated: RestaurantTable = {
      ...existing,
      ...identity,
      isActive: input.isActive !== undefined ? input.isActive : existing.isActive,
      updatedAt: new Date().toISOString(),
    };

    await this.tableRepo.save(updated);
    return updated;
  }
}
