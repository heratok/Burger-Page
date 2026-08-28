import { randomUUID } from 'node:crypto';
import { ProductRepository } from '../../domain/ports/out/ProductRepository.js';
import { Product } from '../../domain/models/Product.js';
import { CreateProductDTO } from '../dtos/index.js';

export class CreateProductUseCase {
  constructor(private productRepo: ProductRepository) {}

  async execute(dto: CreateProductDTO): Promise<Product> {
    const product: Product = {
      id: randomUUID(),
      ...dto
    };
    await this.productRepo.save(product);
    return product;
  }
}
