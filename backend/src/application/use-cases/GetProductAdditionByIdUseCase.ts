import { ProductAdditionRepository } from '../../domain/ports/out/ProductAdditionRepository.js';
import { ProductAddition } from '../../domain/models/ProductAddition.js';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/DomainErrors.js';

export class GetProductAdditionByIdUseCase {
  constructor(private additionRepo: ProductAdditionRepository) {}

  async execute(id: string, restaurantId: string): Promise<ProductAddition> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant ID is required to fetch a product addition.');
    }
    if (!id) {
      throw new ValidationError('Addition ID is required.');
    }

    const addition = await this.additionRepo.findById(id, restaurantId);
    if (!addition || addition.restaurantId !== restaurantId) {
      throw new EntityNotFoundError(`Product addition '${id}' not found for restaurant '${restaurantId}'.`);
    }

    return addition;
  }
}
