import { ProductAdditionRepository } from '../../domain/ports/out/ProductAdditionRepository.js';
import { ProductRepository } from '../../domain/ports/out/ProductRepository.js';
import { ProductAddition } from '../../domain/models/ProductAddition.js';
import { UpdateProductAdditionDTO } from '../dtos/index.js';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/DomainErrors.js';

export class UpdateProductAdditionUseCase {
  constructor(
    private additionRepo: ProductAdditionRepository,
    private productRepo?: ProductRepository
  ) {}

  async execute(id: string, dto: UpdateProductAdditionDTO, restaurantId: string): Promise<ProductAddition> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant ID is required to update a product addition.');
    }
    if (!id) {
      throw new ValidationError('Addition ID is required.');
    }

    const addition = await this.additionRepo.findById(id, restaurantId);
    if (!addition || addition.restaurantId !== restaurantId) {
      throw new EntityNotFoundError(`Product addition '${id}' not found for restaurant '${restaurantId}'.`);
    }

    if (dto.name !== undefined && dto.name.trim() === '') {
      throw new ValidationError('Addition name cannot be empty.');
    }
    if (dto.price !== undefined && (isNaN(dto.price) || dto.price < 0)) {
      throw new ValidationError('Addition price must be a non-negative number.');
    }

    let resolvedProductId = addition.productId;
    if (dto.productId !== undefined) {
      if (dto.productId && dto.productId.trim() !== '') {
        const trimmedProductId = dto.productId.trim();
        if (this.productRepo) {
          const product = await this.productRepo.findById(trimmedProductId, restaurantId);
          if (!product || product.restaurantId !== restaurantId) {
            throw new ValidationError(`Product '${trimmedProductId}' not found for restaurant '${restaurantId}'.`);
          }
        }
        resolvedProductId = trimmedProductId;
      } else {
        resolvedProductId = undefined;
      }
    }

    const updated = new ProductAddition(
      addition.id,
      addition.restaurantId,
      dto.name !== undefined ? dto.name.trim() : addition.name,
      dto.price !== undefined ? Number(dto.price) : addition.price,
      dto.isAvailable !== undefined ? Boolean(dto.isAvailable) : addition.isAvailable,
      resolvedProductId,
      dto.displayOrder !== undefined ? Number(dto.displayOrder) : addition.displayOrder
    );

    await this.additionRepo.save(updated);
    return updated;
  }
}
