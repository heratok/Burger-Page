import { ProductAdditionRepository } from '../../domain/ports/out/ProductAdditionRepository.js';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/DomainErrors.js';

export class DeleteProductAdditionUseCase {
  constructor(private additionRepo: ProductAdditionRepository) {}

  async execute(id: string, restaurantId: string): Promise<void> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant ID is required to delete a product addition.');
    }
    if (!id) {
      throw new ValidationError('Addition ID is required.');
    }

    const addition = await this.additionRepo.findById(id, restaurantId);
    if (!addition || addition.restaurantId !== restaurantId) {
      throw new EntityNotFoundError(`Product addition '${id}' not found for restaurant '${restaurantId}'.`);
    }

    await this.additionRepo.delete(id, restaurantId);
  }
}
