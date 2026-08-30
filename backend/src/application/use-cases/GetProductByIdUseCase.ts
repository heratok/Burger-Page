import { ProductRepository } from '../../domain/ports/out/ProductRepository.js';
import { Product } from '../../domain/models/Product.js';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/DomainErrors.js';

export class GetProductByIdUseCase {
  constructor(private productRepo: ProductRepository) {}

  async execute(id: string, restaurantId: string): Promise<Product> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant ID is required to get product details.');
    }
    const product = await this.productRepo.findById(id, restaurantId);
    if (!product) {
      throw new EntityNotFoundError(`Product '${id}' not found for restaurant '${restaurantId}'.`);
    }
    return product;
  }
}
