import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateOrderUseCase } from '../../src/application/use-cases/CreateOrderUseCase.js';
import { UpdateOrderUseCase } from '../../src/application/use-cases/UpdateOrderUseCase.js';
import { Order } from '../../src/domain/models/Order.js';
import { RestaurantTable } from '../../src/domain/models/RestaurantTable.js';
import { InMemoryRestaurantTableRepository } from '../../src/infrastructure/persistence/InMemoryRestaurantTableRepository.js';
import { ValidationError } from '../../src/domain/errors/DomainErrors.js';

const restaurant: any = {
  id: 'rest-a',
  slug: 'rest-a',
  name: 'Rest A',
  isActive: true,
  deliveryFee: 0,
  minOrderAmount: 0,
  timezone: 'America/Bogota',
  ordersPaused: false,
  schedule: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, open: '00:00', close: '00:00' })),
};

const makeTable = (over: Partial<RestaurantTable> = {}): RestaurantTable => ({
  id: 'tbl_1',
  restaurantId: 'rest-a',
  name: 'Mesa 1',
  sortOrder: 0,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('order table linkage', () => {
  let tableRepo: InMemoryRestaurantTableRepository;
  let orderRepo: any;

  beforeEach(async () => {
    tableRepo = new InMemoryRestaurantTableRepository();
    await tableRepo.save(makeTable());
    await tableRepo.save(makeTable({ id: 'tbl_off', name: 'Mesa off', sortOrder: 1, isActive: false }));
    await tableRepo.save(makeTable({ id: 'tbl_other', restaurantId: 'rest-b', name: 'Mesa 1' }));
    orderRepo = {
      findById: vi.fn(),
      findByRestaurantId: vi.fn(),
      save: vi.fn(),
      update: vi.fn().mockImplementation((order) => Promise.resolve(order)),
      updateStatus: vi.fn(),
    };
  });

  describe('CreateOrderUseCase', () => {
    const build = (withTables = true) => {
      const productRepo: any = {
        findById: vi.fn().mockResolvedValue({ id: 'p1', name: 'Burger', price: 10, isAvailable: true, restaurantId: 'rest-a' }),
        findByRestaurantId: vi.fn().mockResolvedValue([]),
      };
      const restaurantRepo: any = {
        findById: vi.fn().mockResolvedValue(restaurant),
        findBySlug: vi.fn().mockResolvedValue(restaurant),
      };
      const additionRepo: any = { findById: vi.fn(), findByRestaurantId: vi.fn().mockResolvedValue([]) };
      return new CreateOrderUseCase(
        orderRepo,
        productRepo,
        restaurantRepo,
        additionRepo,
        undefined,
        undefined,
        withTables ? tableRepo : undefined
      );
    };
    const dto = (tableId?: string) => ({
      restaurantId: 'rest-a',
      items: [{ productId: 'p1', quantity: 1 }],
      ...(tableId !== undefined ? { tableId } : {}),
    });

    it('stores the table id and a label snapshot for a staff sale', async () => {
      const order = await build().execute(dto('tbl_1'), { authenticated: true });

      expect(order.tableId).toBe('tbl_1');
      expect(order.tableLabel).toBe('Mesa 1');
      expect(order.toJSON()).toMatchObject({ tableId: 'tbl_1', tableLabel: 'Mesa 1' });
      expect(orderRepo.save).toHaveBeenCalledWith(order);
    });

    it('creates a normal sale without table fields when no tableId is sent', async () => {
      const order = await build().execute(dto(), { authenticated: true });

      expect(order.tableId).toBeUndefined();
      expect(order.tableLabel).toBeUndefined();
    });

    it('rejects a tableId on an unauthenticated storefront order and saves nothing', async () => {
      await expect(build().execute(dto('tbl_1'), { authenticated: false })).rejects.toBeInstanceOf(ValidationError);
      expect(orderRepo.save).not.toHaveBeenCalled();
    });

    it('rejects an unknown table, a table of another restaurant and an inactive table', async () => {
      const useCase = build();
      for (const id of ['tbl_missing', 'tbl_other', 'tbl_off']) {
        await expect(useCase.execute(dto(id), { authenticated: true }), id).rejects.toBeInstanceOf(ValidationError);
      }
      expect(orderRepo.save).not.toHaveBeenCalled();
    });

    it('rejects a tableId when the table repository is not wired', async () => {
      await expect(build(false).execute(dto('tbl_1'), { authenticated: true })).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('UpdateOrderUseCase', () => {
    const baseOrder = (table?: { id: string; label: string }): Order => {
      const order = new Order('ord-1', 'rest-a', undefined, [{ productId: 'p', productName: 'P', unitPrice: 10, quantity: 1 }], 'pending', new Date());
      if (table) {
        order.tableId = table.id;
        order.tableLabel = table.label;
      }
      return order;
    };
    const build = () => new UpdateOrderUseCase(orderRepo, undefined, undefined, undefined, tableRepo);

    it('attaches a table to an order', async () => {
      orderRepo.findById.mockResolvedValue(baseOrder());

      const updated = await build().execute('ord-1', { tableId: 'tbl_1' }, 'rest-a');

      expect(updated.tableId).toBe('tbl_1');
      expect(updated.tableLabel).toBe('Mesa 1');
    });

    it('moves an order to another active table and refreshes the label', async () => {
      await tableRepo.save(makeTable({ id: 'tbl_2', name: 'Mesa 2', sortOrder: 2 }));
      orderRepo.findById.mockResolvedValue(baseOrder({ id: 'tbl_1', label: 'Mesa 1' }));

      const updated = await build().execute('ord-1', { tableId: 'tbl_2' }, 'rest-a');

      expect(updated).toMatchObject({ tableId: 'tbl_2', tableLabel: 'Mesa 2' });
    });

    it('detaches the table with null', async () => {
      orderRepo.findById.mockResolvedValue(baseOrder({ id: 'tbl_1', label: 'Mesa 1' }));

      const updated = await build().execute('ord-1', { tableId: null }, 'rest-a');

      expect(updated.tableId).toBeUndefined();
      expect(updated.tableLabel).toBeUndefined();
    });

    it('leaves the table untouched when tableId is not sent', async () => {
      orderRepo.findById.mockResolvedValue(baseOrder({ id: 'tbl_1', label: 'Mesa 1' }));

      const updated = await build().execute('ord-1', { comment: 'x' }, 'rest-a');

      expect(updated).toMatchObject({ tableId: 'tbl_1', tableLabel: 'Mesa 1' });
    });

    it('keeps the order on its current table even if that table was deactivated meanwhile', async () => {
      await tableRepo.save(makeTable({ isActive: false }));
      orderRepo.findById.mockResolvedValue(baseOrder({ id: 'tbl_1', label: 'Mesa 1' }));

      const updated = await build().execute('ord-1', { tableId: 'tbl_1' }, 'rest-a');

      expect(updated).toMatchObject({ tableId: 'tbl_1', tableLabel: 'Mesa 1' });
    });

    it('rejects a table of another restaurant, an unknown table and an inactive new table', async () => {
      for (const id of ['tbl_other', 'tbl_missing', 'tbl_off']) {
        orderRepo.findById.mockResolvedValue(baseOrder());
        await expect(build().execute('ord-1', { tableId: id }, 'rest-a'), id).rejects.toBeInstanceOf(ValidationError);
      }
      expect(orderRepo.update).not.toHaveBeenCalled();
    });
  });
});
