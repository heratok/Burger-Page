import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ORDER_CLOSED_ERROR_FRAGMENT, ORDER_PAUSED_ERROR_FRAGMENT } from '@burger-page/contracts';
import { CreateOrderUseCase } from '../../src/application/use-cases/CreateOrderUseCase.js';
import { OrderRepository } from '../../src/domain/ports/out/OrderRepository.js';
import { ProductRepository } from '../../src/domain/ports/out/ProductRepository.js';
import { ProductAdditionRepository } from '../../src/domain/ports/out/ProductAdditionRepository.js';
import { RestaurantRepository } from '../../src/domain/ports/out/RestaurantRepository.js';
import { ValidationError } from '../../src/domain/errors/DomainErrors.js';

// 2026-10-05 is a Monday. Bogota is UTC-5 (no DST), the server runs in UTC.
const at = (dayOfMonth: number, time: string) => new Date(`2026-10-${String(dayOfMonth).padStart(2, '0')}T${time}:00-05:00`);

const dto = { restaurantId: 'rest-1', items: [{ productId: 'p1', quantity: 1, additions: [] }] };

describe('CreateOrderUseCase - opening hours guard (store-opening-hours T3)', () => {
  let orderRepo: OrderRepository;
  let restaurant: any;
  let now: Date;
  let useCase: CreateOrderUseCase;

  beforeEach(() => {
    restaurant = {
      id: 'rest-1',
      slug: 'rest-1',
      name: 'Rosto',
      isActive: true,
      timezone: 'America/Bogota',
      ordersPaused: false,
      schedule: [{ dayOfWeek: 1, open: '12:00', close: '22:00' }],
    };
    now = at(5, '13:00');

    orderRepo = {
      findById: vi.fn(),
      findByRestaurantId: vi.fn(),
      save: vi.fn(),
      updateStatus: vi.fn(),
    } as unknown as OrderRepository;
    const productRepo = {
      findById: vi.fn().mockResolvedValue({
        id: 'p1', name: 'Burger', price: 20, isAvailable: true, additions: [], category: 'Food', description: '', restaurantId: 'rest-1',
      }),
    } as unknown as ProductRepository;
    const restaurantRepo = {
      findById: vi.fn().mockImplementation(async () => restaurant),
      findBySlug: vi.fn().mockImplementation(async () => restaurant),
    } as unknown as RestaurantRepository;
    const additionRepo = { findById: vi.fn() } as unknown as ProductAdditionRepository;

    useCase = new CreateOrderUseCase(orderRepo, productRepo, restaurantRepo, additionRepo, undefined, () => now);
  });

  const expectRejected = async (fragment: string, opts?: { authenticated?: boolean }) => {
    const savedBefore = vi.mocked(orderRepo.save).mock.calls.length;
    const err = await useCase.execute(dto, opts).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toContain(fragment);
    expect(vi.mocked(orderRepo.save).mock.calls.length).toBe(savedBefore);
    return err as ValidationError;
  };

  it('accepts a public order inside the opening hours', async () => {
    const order = await useCase.execute(dto);
    expect(order.status).toBe('pending');
    expect(orderRepo.save).toHaveBeenCalledTimes(1);
  });

  it('accepts the opening minute and rejects the closing minute (close is exclusive)', async () => {
    now = at(5, '12:00');
    await expect(useCase.execute(dto)).resolves.toBeDefined();
    now = at(5, '22:00');
    await expectRejected(ORDER_CLOSED_ERROR_FRAGMENT);
  });

  it('rejects a public order outside the hours with a recognizable message', async () => {
    now = at(5, '23:00');
    const err = await expectRejected(ORDER_CLOSED_ERROR_FRAGMENT);
    expect(err.message).toBe("El restaurante 'Rosto' está fuera del horario de atención.");
  });

  it('rejects on a weekday without ranges (closed day)', async () => {
    now = at(6, '13:00'); // Tuesday
    await expectRejected(ORDER_CLOSED_ERROR_FRAGMENT);
  });

  it('rejects when the schedule is empty (closed every day)', async () => {
    restaurant.schedule = [];
    await expectRejected(ORDER_CLOSED_ERROR_FRAGMENT);
  });

  it('rejects while orders are paused even though the schedule is open', async () => {
    restaurant.ordersPaused = true;
    const err = await expectRejected(ORDER_PAUSED_ERROR_FRAGMENT);
    expect(err.message).toBe("El restaurante 'Rosto' tiene los pedidos en pausa.");
  });

  it('reports the pause when the restaurant is both paused and closed', async () => {
    restaurant.ordersPaused = true;
    now = at(5, '23:30');
    await expectRejected(ORDER_PAUSED_ERROR_FRAGMENT);
  });

  it('honours overnight ranges across midnight', async () => {
    restaurant.schedule = [{ dayOfWeek: 1, open: '20:00', close: '02:00' }];
    now = at(5, '23:30');
    await expect(useCase.execute(dto)).resolves.toBeDefined();
    now = at(6, '01:30'); // Tuesday, still Monday's range
    await expect(useCase.execute(dto)).resolves.toBeDefined();
    now = at(6, '02:30');
    await expectRejected(ORDER_CLOSED_ERROR_FRAGMENT);
  });

  it("evaluates the hours in the restaurant's timezone, not the server's (UTC)", async () => {
    restaurant.schedule = [{ dayOfWeek: 1, open: '20:00', close: '23:00' }];
    // 2026-10-06T03:00Z is Tuesday in UTC but Monday 22:00 in Bogota
    now = new Date('2026-10-06T03:00:00Z');
    await expect(useCase.execute(dto)).resolves.toBeDefined();

    restaurant.timezone = 'UTC';
    await expectRejected(ORDER_CLOSED_ERROR_FRAGMENT);
  });

  it('lets authenticated staff create manual sales while closed or paused', async () => {
    now = at(5, '23:30');
    restaurant.ordersPaused = true;
    await expect(useCase.execute(dto, { authenticated: true })).resolves.toBeDefined();
    expect(orderRepo.save).toHaveBeenCalledTimes(1);
  });

  it('keeps the inactive-restaurant error ahead of the opening hours check', async () => {
    restaurant.isActive = false;
    now = at(5, '23:30');
    const err = await useCase.execute(dto).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toContain('no está activo');
  });
});
