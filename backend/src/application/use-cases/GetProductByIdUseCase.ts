import { ProductRepository } from '../../domain/ports/out/ProductRepository.js';
import { Product } from '../../domain/models/Product.js';
import { EntityNotFoundError } from '../../domain/errors/DomainErrors.js';

export class GetProductByIdUseCase {
  constructor(private productRepo: ProductRepository) {}

  async execute(id: string): Promise<Product> {
    const product = await this.productRepo.findById(id);
    if (!product) throw new EntityNotFoundError('Product not found');
    return product;
  }
}
