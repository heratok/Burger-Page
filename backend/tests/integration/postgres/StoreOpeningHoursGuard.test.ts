import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { PgRestaurantRepository } from '../../../src/infrastructure/persistence/postgres/PgRestaurantRepository.js';
import { CreateOrderUseCase } from '../../../src/application/use-cases/CreateOrderUseCase.js';
import { ValidationError } from '../../../src/domain/errors/DomainErrors.js';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/burger_page_test';
const APP_USER_DATABASE_URL =
  process.env.APP_USER_DATABASE_URL || 'postgres://app_user:app_user_test_only@localhost:5432/burger_page_test';

let isDbConnected = false;

// End to end seam: a schedule stored in Postgres (TIME columns, restaurant
// timezone) drives the CreateOrderUseCase guard through the real repository.
describe('opening hours guard on top of PgRestaurantRepository (store-opening-hours T3)', () => {
  let adminPool: pg.Pool;
  let repo: PgRestaurantRepository;
  const ID = `pgguard-${randomUUID().slice(0, 8)}`;
  let now: Date;
  let saveOrder: ReturnType<typeof vi.fn>;
  let useCase: CreateOrderUseCase;

  beforeAll(async () => {
    process.env.DATABASE_URL = APP_USER_DATABASE_URL;
    adminPool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2000 });
    try {
      await adminPool.query('SELECT 1');
      isDbConnected = true;
    } catch (err: any) {
      console.warn(`\n[StoreOpeningHoursGuard] Skipping: cannot connect (${err.message}).`);
      return;
    }
    repo = new PgRestaurantRepository();
    await repo.save({
      id: ID,
      slug: ID,
      name: 'Guard Test',
      theme: 'dark-charcoal',
      isActive: true,
      timezone: 'America/Bogota',
      ordersPaused: false,
      schedule: [
        { dayOfWeek: 1, open: '12:00', close: '22:00' },
        { dayOfWeek: 5, open: '20:00', close: '02:00' },
      ],
    });

    saveOrder = vi.fn();
    useCase = new CreateOrderUseCase(
      { save: saveOrder } as any,
      { findById: async () => ({ id: 'p1', name: 'Burger', price: 20, isAvailable: true, additions: [], category: 'F', description: '', restaurantId: ID }) } as any,
      repo,
      {} as any,
      undefined,
      () => now
    );
  });

  afterAll(async () => {
    if (isDbConnected) await adminPool.query(`DELETE FROM public.restaurants WHERE id = $1`, [ID]);
    await adminPool?.end();
  });

  const dto = () => ({ restaurantId: ID, items: [{ productId: 'p1', quantity: 1, additions: [] }] });

  it('accepts an order inside the stored hours and rejects one outside, in the stored timezone', async () => {
    if (!isDbConnected) return;
    now = new Date('2026-10-05T13:00:00-05:00'); // Monday 13:00 Bogota (18:00 UTC)
    await expect(useCase.execute(dto())).resolves.toBeDefined();

    now = new Date('2026-10-05T23:30:00-05:00'); // Monday 23:30 Bogota
    await expect(useCase.execute(dto())).rejects.toThrow(ValidationError);

    now = new Date('2026-10-06T03:00:00Z'); // Tuesday in UTC, Monday 22:00 in Bogota -> closed (22:00 exclusive)
    await expect(useCase.execute(dto())).rejects.toThrow(ValidationError);
  });

  it('honours an overnight range stored as TIME (Friday 20:00 - 02:00 is open Saturday 01:00)', async () => {
    if (!isDbConnected) return;
    now = new Date('2026-10-10T01:00:00-05:00'); // Saturday 01:00 Bogota
    await expect(useCase.execute(dto())).resolves.toBeDefined();
    now = new Date('2026-10-10T02:30:00-05:00');
    await expect(useCase.execute(dto())).rejects.toThrow(ValidationError);
  });

  it('rejects while paused, and a paused flag persisted by the repository is honoured', async () => {
    if (!isDbConnected) return;
    const current = (await repo.findById(ID))!;
    await repo.save({ ...current, ordersPaused: true });
    now = new Date('2026-10-05T13:00:00-05:00');
    await expect(useCase.execute(dto())).rejects.toThrow(/pausa/);
    await repo.save({ ...current, ordersPaused: false });
    await expect(useCase.execute(dto())).resolves.toBeDefined();
  });
});
