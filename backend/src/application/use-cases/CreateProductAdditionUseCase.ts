import { randomUUID } from 'node:crypto';
import { ProductAdditionRepository } from '../../domain/ports/out/ProductAdditionRepository.js';
import { ProductRepository } from '../../domain/ports/out/ProductRepository.js';
import { ProductAddition } from '../../domain/models/ProductAddition.js';
import { CreateProductAdditionDTO } from '../dtos/index.js';
import { ValidationError } from '../../domain/errors/DomainErrors.js';

export class CreateProductAdditionUseCase {
  constructor(
    private additionRepo: ProductAdditionRepository,
    private productRepo?: ProductRepository
  ) {}

  async execute(dto: CreateProductAdditionDTO, restaurantId: string): Promise<ProductAddition> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant ID is required to create a product addition.');
    }
    if (!dto.name || dto.name.trim() === '') {
      throw new ValidationError('Addition name cannot be empty.');
    }
    if (dto.price === undefined || dto.price === null || isNaN(dto.price) || dto.price < 0) {
      throw new ValidationError('Addition price must be a non-negative number.');
    }

    let productId: string | undefined = undefined;
    if (dto.productId && dto.productId.trim() !== '') {
      productId = dto.productId.trim();
      if (this.productRepo) {
        const product = await this.productRepo.findById(productId, restaurantId);
        if (!product || product.restaurantId !== restaurantId) {
          throw new ValidationError(`Product '${productId}' not found for restaurant '${restaurantId}'.`);
        }
      }
    }

    const addition = new ProductAddition(
      `add_${randomUUID()}`,
      restaurantId,
      dto.name.trim(),
      Number(dto.price),
      dto.isAvailable !== undefined ? Boolean(dto.isAvailable) : true,
      productId,
      dto.displayOrder !== undefined ? Number(dto.displayOrder) : 0
    );

    await this.additionRepo.save(addition);
    return addition;
  }
}
