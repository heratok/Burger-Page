import { ProductRepository } from '../../domain/ports/out/ProductRepository.js';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/DomainErrors.js';

export class DeleteProductUseCase {
  constructor(private productRepo: ProductRepository) {}

  async execute(id: string, restaurantId: string): Promise<void> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant ID is required to delete a product.');
    }

    const product = await this.productRepo.findById(id, restaurantId);
    if (!product) {
      throw new EntityNotFoundError(`Product '${id}' not found for restaurant '${restaurantId}'.`);
    }

    await this.productRepo.delete(id, restaurantId);
  }
}
