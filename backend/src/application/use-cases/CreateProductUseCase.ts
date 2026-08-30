import { randomUUID } from 'node:crypto';
import { ProductRepository } from '../../domain/ports/out/ProductRepository.js';
import { ProductAdditionRepository } from '../../domain/ports/out/ProductAdditionRepository.js';
import { Product } from '../../domain/models/Product.js';
import { CreateProductDTO } from '../dtos/index.js';
import { ValidationError } from '../../domain/errors/DomainErrors.js';

export class CreateProductUseCase {
  constructor(
    private productRepo: ProductRepository,
    private additionRepo?: ProductAdditionRepository
  ) {}

  async execute(dto: CreateProductDTO, restaurantId: string): Promise<Product> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant ID is required to create a product.');
    }
    if (!dto.name || dto.name.trim() === '') {
      throw new ValidationError('Product name cannot be empty.');
    }
    if (dto.price === undefined || dto.price === null || isNaN(dto.price) || dto.price < 0) {
      throw new ValidationError('Product price must be a non-negative number.');
    }

    // Validar que las adiciones pertenezcan al mismo restaurante si se especificaron y hay repositorio
    if (dto.additions && dto.additions.length > 0 && this.additionRepo) {
      for (const addId of dto.additions) {
        const addition = await this.additionRepo.findById(addId, restaurantId);
        if (!addition || addition.restaurantId !== restaurantId) {
          throw new ValidationError(`Addition '${addId}' does not belong to restaurant '${restaurantId}'.`);
        }
      }
    }

    const product: Product = {
      id: `prod_${randomUUID()}`,
      restaurantId,
      name: dto.name.trim(),
      description: dto.description || '',
      price: Number(dto.price),
      category: dto.category || 'General',
      categoryId: dto.categoryId,
      imageUrl: dto.imageUrl,
      isAvailable: dto.isAvailable !== undefined ? Boolean(dto.isAvailable) : true,
      isPopular: Boolean(dto.isPopular),
      isNew: Boolean(dto.isNew),
      preparationTimeMinutes: dto.preparationTimeMinutes !== undefined ? Number(dto.preparationTimeMinutes) : 15,
      displayOrder: dto.displayOrder !== undefined ? Number(dto.displayOrder) : 0,
      additions: dto.additions || [],
    };

    await this.productRepo.save(product);
    return product;
  }
}
