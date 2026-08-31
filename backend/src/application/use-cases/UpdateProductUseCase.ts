import { ProductRepository } from '../../domain/ports/out/ProductRepository.js';
import { CategoryRepository } from '../../domain/ports/out/CategoryRepository.js';
import { ProductAdditionRepository } from '../../domain/ports/out/ProductAdditionRepository.js';
import { Product } from '../../domain/models/Product.js';
import { UpdateProductDTO } from '../dtos/index.js';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/DomainErrors.js';

export class UpdateProductUseCase {
  constructor(
    private productRepo: ProductRepository,
    private categoryRepo: CategoryRepository,
    private additionRepo?: ProductAdditionRepository
  ) {}

  async execute(id: string, dto: UpdateProductDTO, restaurantId: string): Promise<Product> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant ID is required to update a product.');
    }

    const product = await this.productRepo.findById(id, restaurantId);
    if (!product) {
      throw new EntityNotFoundError(`Product '${id}' not found for restaurant '${restaurantId}'.`);
    }

    if (dto.name !== undefined && dto.name.trim() === '') {
      throw new ValidationError('Product name cannot be empty.');
    }
    if (dto.price !== undefined && (isNaN(dto.price) || dto.price < 0)) {
      throw new ValidationError('Product price must be a non-negative number.');
    }

    let resolvedCategoryId = dto.categoryId !== undefined ? dto.categoryId : product.categoryId;
    let resolvedCategoryName = product.category;

    if (dto.categoryId !== undefined) {
      const category = await this.categoryRepo.findById(dto.categoryId, restaurantId);
      if (!category) {
        throw new ValidationError(`Category with ID '${dto.categoryId}' not found for restaurant '${restaurantId}'.`);
      }
      if (category.isActive === false) {
        throw new ValidationError(`Category '${category.name}' is currently inactive.`);
      }
      resolvedCategoryId = category.id;
      resolvedCategoryName = category.name;
    } else if (dto.category !== undefined && dto.category.trim() !== '') {
      const category = await this.categoryRepo.findByName(dto.category.trim(), restaurantId);
      if (!category) {
        throw new ValidationError(`Category '${dto.category.trim()}' does not exist for restaurant '${restaurantId}'.`);
      }
      if (category.isActive === false) {
        throw new ValidationError(`Category '${category.name}' is currently inactive.`);
      }
      resolvedCategoryId = category.id;
      resolvedCategoryName = category.name;
    }

    // Validar adiciones si se especificaron
    if (dto.additions && dto.additions.length > 0 && this.additionRepo) {
      for (const addId of dto.additions) {
        const addition = await this.additionRepo.findById(addId, restaurantId);
        if (!addition || addition.restaurantId !== restaurantId) {
          throw new ValidationError(`Addition '${addId}' does not belong to restaurant '${restaurantId}'.`);
        }
      }
    }

    const updated: Product = {
      ...product,
      name: dto.name !== undefined ? dto.name.trim() : product.name,
      description: dto.description !== undefined ? dto.description : product.description,
      price: dto.price !== undefined ? Number(dto.price) : product.price,
      category: resolvedCategoryName,
      categoryId: resolvedCategoryId,
      imageUrl: dto.imageUrl !== undefined ? dto.imageUrl : product.imageUrl,
      isAvailable: dto.isAvailable !== undefined ? Boolean(dto.isAvailable) : product.isAvailable,
      isPopular: dto.isPopular !== undefined ? Boolean(dto.isPopular) : product.isPopular,
      isNew: dto.isNew !== undefined ? Boolean(dto.isNew) : product.isNew,
      preparationTimeMinutes: dto.preparationTimeMinutes !== undefined ? Number(dto.preparationTimeMinutes) : product.preparationTimeMinutes,
      displayOrder: dto.displayOrder !== undefined ? Number(dto.displayOrder) : product.displayOrder,
      additions: dto.additions !== undefined ? dto.additions : product.additions,
    };

    await this.productRepo.save(updated);
    return updated;
  }
}
