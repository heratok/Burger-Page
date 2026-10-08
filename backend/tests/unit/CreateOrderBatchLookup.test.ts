import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateOrderUseCase } from '../../src/application/use-cases/CreateOrderUseCase.js';
import { EntityNotFoundError, ValidationError } from '../../src/domain/errors/DomainErrors.js';
import { ProductAddition } from '../../src/domain/models/ProductAddition.js';

const restaurant: any = {
  id: 'burger-craft',
  slug: 'burger-craft',
  name: 'Burger Craft',
  isActive: true,
  deliveryFee: 0,
  minOrderAmount: 0,
  timezone: 'America/Bogota',
  ordersPaused: false,
  schedule: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, open: '00:00', close: '00:00' })),
};

const product = (id: string, extra: Record<string, unknown> = {}): any => ({
  id,
  name: `Product ${id}`,
  price: 10,
  isAvailable: true,
  additions: [],
  category: 'Food',
  description: '',
  restaurantId: 'burger-craft',
  ...extra,
});

describe('CreateOrderUseCase batched lookups', () => {
  let productRepo: any;
  let additionRepo: any;
  let orderRepo: any;
  let useCase: CreateOrderUseCase;

  beforeEach(() => {
    orderRepo = { findById: vi.fn(), findByRestaurantId: vi.fn(), save: vi.fn(), updateStatus: vi.fn() };
    productRepo = {
      findById: vi.fn().mockResolvedValue(null),
      findByIds: vi.fn().mockResolvedValue([]),
      findByRestaurantId: vi.fn().mockResolvedValue([]),
      save: vi.fn(),
      delete: vi.fn(),
    };
    additionRepo = {
      findById: vi.fn().mockResolvedValue(null),
      findByIds: vi.fn().mockResolvedValue([]),
      findByRestaurantId: vi.fn().mockResolvedValue([]),
      findByProductId: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };
    const restaurantRepo: any = {
      findById: vi.fn().mockResolvedValue(restaurant),
      findBySlug: vi.fn().mockResolvedValue(restaurant),
    };
    useCase = new CreateOrderUseCase(orderRepo, productRepo, restaurantRepo, additionRepo);
  });

  it('fetches 3 items and 2 additions with one findByIds each and never calls findById', async () => {
    productRepo.findByIds.mockResolvedValue([product('p1'), product('p2'), product('p3')]);
    additionRepo.findByIds.mockResolvedValue([
      new ProductAddition('a1', 'burger-craft', 'Cheese', 2, true),
      new ProductAddition('a2', 'burger-craft', 'Bacon', 3, true),
    ]);

    const order = await useCase.execute({
      restaurantId: 'burger-craft',
      items: [
        { productId: 'p1', quantity: 1, additions: [{ additionId: 'a1', quantity: 1 }] },
        { productId: 'p2', quantity: 2, additions: [{ additionId: 'a2', quantity: 1 }] },
        { productId: 'p3', quantity: 1, additions: [] },
      ],
    } as any);

    expect(productRepo.findByIds).toHaveBeenCalledTimes(1);
    expect(additionRepo.findByIds).toHaveBeenCalledTimes(1);
    expect(productRepo.findByIds).toHaveBeenCalledWith(['p1', 'p2', 'p3'], 'burger-craft');
    expect(additionRepo.findByIds).toHaveBeenCalledWith(['a1', 'a2'], 'burger-craft');
    expect(productRepo.findById).not.toHaveBeenCalled();
    expect(additionRepo.findById).not.toHaveBeenCalled();
    // (10+2)*1 + (10+3)*2 + 10 = 48, prices come from the repository
    expect(order.subtotal).toBe(48);
  });

  it('fetches a product id repeated across items only once', async () => {
    productRepo.findByIds.mockResolvedValue([product('p1')]);

    await useCase.execute({
      restaurantId: 'burger-craft',
      items: [
        { productId: 'p1', quantity: 1, additions: [] },
        { productId: 'p1', quantity: 2, additions: [] },
      ],
    } as any);

    expect(productRepo.findByIds).toHaveBeenCalledWith(['p1'], 'burger-craft');
    expect(productRepo.findById).not.toHaveBeenCalled();
  });

  it('falls back to the per-id path for ids missing from the batch (name tolerance)', async () => {
    productRepo.findByRestaurantId.mockResolvedValue([product('p9', { name: 'Classic' })]);

    const order = await useCase.execute({
      restaurantId: 'burger-craft',
      items: [{ productId: 'classic', quantity: 1, additions: [] }],
    } as any);

    expect(productRepo.findById).toHaveBeenCalledWith('classic', 'burger-craft');
    expect(order.items[0].productId).toBe('p9');
  });

  it('keeps the same not-found errors when the batch misses and the fallback misses', async () => {
    await expect(
      useCase.execute({ restaurantId: 'burger-craft', items: [{ productId: 'nope', quantity: 1 }] } as any)
    ).rejects.toThrow(new EntityNotFoundError('Producto no encontrado o no disponible para este restaurante.'));

    productRepo.findByIds.mockResolvedValue([product('p1')]);
    await expect(
      useCase.execute({
        restaurantId: 'burger-craft',
        items: [{ productId: 'p1', quantity: 1, additions: [{ additionId: 'ghost', quantity: 1 }] }],
      } as any)
    ).rejects.toThrow(new EntityNotFoundError('Adición no encontrada para este restaurante.'));
    expect(additionRepo.findById).toHaveBeenCalledWith('ghost', 'burger-craft');
  });

  it('keeps the unavailable product error for a prefetched product', async () => {
    productRepo.findByIds.mockResolvedValue([product('p1', { isAvailable: false })]);

    await expect(
      useCase.execute({ restaurantId: 'burger-craft', items: [{ productId: 'p1', quantity: 1 }] } as any)
    ).rejects.toThrow(new ValidationError('El producto no está disponible en este momento.'));
  });

  it('still works with repositories that do not implement findByIds', async () => {
    delete productRepo.findByIds;
    delete additionRepo.findByIds;
    productRepo.findById.mockResolvedValue(product('p1'));

    const order = await useCase.execute({
      restaurantId: 'burger-craft',
      items: [{ productId: 'p1', quantity: 1, additions: [] }],
    } as any);

    expect(order.subtotal).toBe(10);
    expect(productRepo.findById).toHaveBeenCalledTimes(1);
  });
});
