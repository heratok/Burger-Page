import { ProductAdditionRepository } from '../../domain/ports/out/ProductAdditionRepository.js';
import { ProductAddition } from '../../domain/models/ProductAddition.js';
import { ValidationError } from '../../domain/errors/DomainErrors.js';

export class ListProductAdditionsUseCase {
  constructor(private additionRepo: ProductAdditionRepository) {}

  async execute(restaurantId: string, productId?: string): Promise<ProductAddition[]> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant ID is required to list product additions.');
    }

    if (productId && productId.trim() !== '') {
      return this.additionRepo.findByProductId(productId.trim(), restaurantId);
    }

    return this.additionRepo.findByRestaurantId(restaurantId);
  }
}
