import { ProductRepository } from '../../domain/ports/out/ProductRepository.js';
import { Product } from '../../domain/models/Product.js';
import { ValidationError } from '../../domain/errors/DomainErrors.js';

export class ListProductsUseCase {
  constructor(private productRepo: ProductRepository) {}

  async execute(restaurantId: string, isAvailableOnly: boolean = false): Promise<Product[]> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant ID is required to list products.');
    }

    const products = await this.productRepo.findByRestaurantId(restaurantId);
    if (isAvailableOnly) {
      return products.filter((p) => p.isAvailable);
    }
    return products;
  }
}
