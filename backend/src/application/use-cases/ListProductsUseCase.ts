import { ProductRepository } from '../../domain/ports/out/ProductRepository.js';
import { Product } from '../../domain/models/Product.js';
import { ValidationError } from '../../domain/errors/DomainErrors.js';
import { ListOptions, PaginatedResult } from '../../domain/ports/out/ListOptions.js';

export class ListProductsUseCase {
  constructor(private productRepo: ProductRepository) {}

  async execute(restaurantId: string): Promise<Product[]>;
  async execute(restaurantId: string, isAvailableOnly: boolean): Promise<Product[]>;
  async execute(restaurantId: string, isAvailableOnly: boolean, options: ListOptions): Promise<PaginatedResult<Product>>;
  async execute(
    restaurantId: string,
    isAvailableOnly: boolean = false,
    options?: ListOptions
  ): Promise<Product[] | PaginatedResult<Product>> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant ID is required to list products.');
    }

    if (options?.limit !== undefined) {
      const limit = options.limit;
      const page = options.page && options.page >= 1 ? options.page : 1;

      if (isAvailableOnly) {
        // The availability filter must be applied BEFORE pagination, otherwise
        // a limited page of all products would under-fill after the JS filter.
        // Fetch the tenant set, filter, then slice the page in memory.
        const all = await this.productRepo.findByRestaurantId(restaurantId);
        const available = all.filter((p) => p.isAvailable);
        const start = (page - 1) * limit;
        return { items: available.slice(start, start + limit), total: available.length };
      }

      const [items, total] = await Promise.all([
        this.productRepo.findByRestaurantId(restaurantId, options),
        this.productRepo.countByRestaurantId?.(restaurantId),
      ]);
      return { items, total: total ?? items.length };
    }

    const products = await this.productRepo.findByRestaurantId(restaurantId);
    if (isAvailableOnly) {
      return products.filter((p) => p.isAvailable);
    }
    return products;
  }
}