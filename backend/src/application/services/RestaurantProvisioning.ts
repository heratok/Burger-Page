import { ID_PREFIX, newId } from '../../domain/shared/newId.js';
import { RestaurantRepository } from '../../domain/ports/out/RestaurantRepository.js';
import { CategoryRepository } from '../../domain/ports/out/CategoryRepository.js';
import { ProductRepository } from '../../domain/ports/out/ProductRepository.js';
import { ProductAdditionRepository } from '../../domain/ports/out/ProductAdditionRepository.js';
import { ProductAddition } from '../../domain/models/ProductAddition.js';
import { ValidationError } from '../../domain/errors/DomainErrors.js';
import { RestaurantTemplate, scaleTemplatePrice } from '../../domain/templates/restaurantTemplates.js';

export interface SeededIds {
  categories: string[];
  products: string[];
  additions: string[];
}

function logCleanup(err: unknown): void {
  console.error('Could not remove a seeded row while rolling back a failed create:', err);
}

/**
 * The provision-then-compensate half of creating a restaurant: seeding a
 * template's sample categories/products/additions, and undoing a tenant
 * (plus whatever of that sample data was already written) when a later step
 * in CreateRestaurantUseCase fails. Not transactional across repositories —
 * each adapter opens its own tenant transaction — so compensation is this
 * module's job, kept in one place instead of inlined in the use case.
 */
export class RestaurantProvisioning {
  constructor(
    private readonly restaurantRepo: RestaurantRepository,
    private readonly categoryRepo?: CategoryRepository,
    private readonly productRepo?: ProductRepository,
    private readonly additionRepo?: ProductAdditionRepository
  ) {}

  async seedTemplate(
    template: RestaurantTemplate,
    categoryNames: string[],
    restaurantId: string,
    currency: string,
    seeded: SeededIds
  ): Promise<void> {
    const { categoryRepo, productRepo, additionRepo } = this;
    if (!categoryRepo || !productRepo || !additionRepo) {
      // A template that promises dishes must never silently create none.
      throw new ValidationError('Restaurant templates with sample data are not available in this deployment');
    }

    const categoryIds = new Map<string, string>();
    for (let i = 0; i < categoryNames.length; i++) {
      const id = newId(ID_PREFIX.category);
      await categoryRepo.save({ id, restaurantId, name: categoryNames[i], displayOrder: i, isActive: true });
      seeded.categories.push(id);
      categoryIds.set(categoryNames[i].toLowerCase(), id);
    }

    for (let i = 0; i < template.products.length; i++) {
      const p = template.products[i];
      const id = newId(ID_PREFIX.product);
      seeded.products.push(id);
      await productRepo.save({
        id,
        restaurantId,
        name: p.name,
        description: p.description,
        price: scaleTemplatePrice(p.price, currency),
        category: p.category,
        categoryId: categoryIds.get(p.category.toLowerCase()),
        isAvailable: true,
        isPopular: p.isPopular ?? false,
        isNew: p.isNew ?? false,
        preparationTimeMinutes: p.preparationTimeMinutes ?? 15,
        displayOrder: i,
        additions: [],
      });
    }

    for (let i = 0; i < template.additions.length; i++) {
      const a = template.additions[i];
      const id = newId(ID_PREFIX.addition);
      seeded.additions.push(id);
      await additionRepo.save(
        new ProductAddition(id, restaurantId, a.name, scaleTemplatePrice(a.price, currency), true, undefined, i)
      );
    }
  }

  async rollbackTenant(restaurantId: string, seeded?: SeededIds): Promise<void> {
    // Seeded rows go first, best effort: Postgres also cascades them with the
    // tenant, but the other adapters have no foreign keys to do it.
    if (seeded) {
      for (const id of seeded.additions) await this.additionRepo?.delete(id, restaurantId).catch(logCleanup);
      for (const id of seeded.products) await this.productRepo?.delete(id, restaurantId).catch(logCleanup);
      for (const id of seeded.categories) await this.categoryRepo?.delete(id, restaurantId).catch(logCleanup);
    }
    try {
      // Prefer physically removing the half-created tenant; adapters without
      // hardDelete fall back to the (deleted_at) soft delete.
      await (this.restaurantRepo.hardDelete ?? this.restaurantRepo.delete).call(this.restaurantRepo, restaurantId);
    } catch (cleanupErr) {
      console.error(`Could not roll back restaurant ${restaurantId} after a failed create:`, cleanupErr);
    }
  }
}
