import { ProductRepository } from '../../domain/ports/out/ProductRepository.js';
import { Product } from '../../domain/models/Product.js';
import { UpdateProductDTO } from '../dtos/index.js';
import { EntityNotFoundError } from '../../domain/errors/DomainErrors.js';

export class UpdateProductUseCase {
  constructor(private productRepo: ProductRepository) {}

  async execute(id: string, dto: UpdateProductDTO): Promise<Product> {
    const product = await this.productRepo.findById(id);
    if (!product) throw new EntityNotFoundError('Product not found');

    const updated = { ...product, ...dto };
    await this.productRepo.save(updated);
    return updated;
  }
}
