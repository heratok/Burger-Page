import { ProductRepository } from '../../domain/ports/out/ProductRepository.js';
import { Product } from '../../domain/models/Product.js';

export class ListProductsUseCase {
  constructor(private productRepo: ProductRepository) {}

  async execute(): Promise<Product[]> {
    return this.productRepo.findAll();
  }
}
