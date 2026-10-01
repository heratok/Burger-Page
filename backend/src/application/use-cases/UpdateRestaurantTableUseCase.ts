import { RestaurantTableRepository } from '../../domain/ports/out/RestaurantTableRepository.js';
import { RestaurantTable } from '../../domain/models/RestaurantTable.js';
import { EntityNotFoundError } from '../../domain/errors/DomainErrors.js';
import { validateTableName } from './CreateRestaurantTableUseCase.js';

export interface UpdateRestaurantTableInput {
  name?: string;
  isActive?: boolean;
}

export class UpdateRestaurantTableUseCase {
  constructor(private tableRepo: RestaurantTableRepository) {}

  async execute(id: string, restaurantId: string, input: UpdateRestaurantTableInput): Promise<RestaurantTable> {
    const existing = await this.tableRepo.findById(id, restaurantId);
    if (!existing) {
      throw new EntityNotFoundError('Mesa no encontrada.');
    }

    const updated: RestaurantTable = {
      ...existing,
      name: input.name !== undefined ? validateTableName(input.name) : existing.name,
      isActive: input.isActive !== undefined ? input.isActive : existing.isActive,
      updatedAt: new Date().toISOString(),
    };

    await this.tableRepo.save(updated);
    return updated;
  }
}
