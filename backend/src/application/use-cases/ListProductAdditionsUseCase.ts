import { ProductAdditionRepository } from '../../domain/ports/out/ProductAdditionRepository.js';
import { ProductAddition } from '../../domain/models/ProductAddition.js';
import { ValidationError } from '../../domain/errors/DomainErrors.js';
import { ListOptions, PaginatedResult } from '../../domain/ports/out/ListOptions.js';

export class ListProductAdditionsUseCase {
  constructor(private additionRepo: ProductAdditionRepository) {}

  async execute(restaurantId: string): Promise<ProductAddition[]>;
  async execute(restaurantId: string, productId?: string): Promise<ProductAddition[]>;
  async execute(
    restaurantId: string,
    productId: string | undefined,
    options: ListOptions
  ): Promise<PaginatedResult<ProductAddition>>;
  async execute(
    restaurantId: string,
    productId?: string,
    options?: ListOptions
  ): Promise<ProductAddition[] | PaginatedResult<ProductAddition>> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant ID is required to list product additions.');
    }

    const hasProductFilter = Boolean(productId) && productId!.trim() !== '';

    if (options?.limit !== undefined) {
      const limit = options.limit;
      const page = options.page && options.page >= 1 ? options.page : 1;

      if (hasProductFilter) {
        // The port exposes no per-product count, so the per-product filtered
        // set is fetched, counted and page-sliced in memory. Additions per
        // product are small and the limit is bounded (<= 100).
        const all = await this.additionRepo.findByProductId(productId!.trim(), restaurantId);
        const start = (page - 1) * limit;
        return { items: all.slice(start, start + limit), total: all.length };
      }

      const [items, total] = await Promise.all([
        this.additionRepo.findByRestaurantId(restaurantId, options),
        this.additionRepo.countByRestaurantId?.(restaurantId),
      ]);
      return { items, total: total ?? items.length };
    }

    if (hasProductFilter) {
      return this.additionRepo.findByProductId(productId!.trim(), restaurantId);
    }

    return this.additionRepo.findByRestaurantId(restaurantId);
  }
}