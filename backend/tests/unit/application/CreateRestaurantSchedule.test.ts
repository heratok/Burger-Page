import { describe, it, expect, vi } from 'vitest';
import { CreateRestaurantUseCase } from '../../../src/application/use-cases/CreateRestaurantUseCase.js';
import { RestaurantRepository } from '../../../src/domain/ports/out/RestaurantRepository.js';
import { ValidationError } from '../../../src/domain/errors/DomainErrors.js';

function repo() {
  return {
    findById: vi.fn(),
    findBySlug: vi.fn().mockResolvedValue(null),
    slugExists: vi.fn().mockResolvedValue(false),
    findAll: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  } as unknown as RestaurantRepository & { save: ReturnType<typeof vi.fn> };
}

const week = (open: string, close: string) =>
  [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, open, close }));

describe('CreateRestaurantUseCase - opening schedule (store-opening-hours T2)', () => {
  it('starts every new restaurant open 12:00-22:30 on all 7 days, in Bogota, not paused', async () => {
    const r = repo();
    const created = await new CreateRestaurantUseCase(r).execute({ name: 'Tienda de Pruebas', slug: 'tienda-pruebas' });

    expect(created.schedule).toEqual(week('12:00', '22:30'));
    expect(created.timezone).toBe('America/Bogota');
    expect(created.ordersPaused).toBe(false);
    expect(r.save.mock.calls[0][0].schedule).toEqual(week('12:00', '22:30'));
  });

  it('honours an explicit schedule, timezone and paused flag', async () => {
    const r = repo();
    const schedule = [{ dayOfWeek: 5, open: '18:00', close: '02:00' }];
    const created = await new CreateRestaurantUseCase(r).execute({
      name: 'Tienda de Pruebas',
      slug: 'tienda-pruebas',
      schedule,
      timezone: 'America/Mexico_City',
      ordersPaused: true,
    });

    expect(created.schedule).toEqual(schedule);
    expect(created.timezone).toBe('America/Mexico_City');
    expect(created.ordersPaused).toBe(true);
  });

  it('applies a legacy "HH:MM - HH:MM" config.openingHours text to every weekday when no schedule is given', async () => {
    const created = await new CreateRestaurantUseCase(repo()).execute({
      name: 'Tienda de Pruebas',
      slug: 'tienda-pruebas',
      config: { openingHours: '09:30 - 21:00' },
    });
    expect(created.schedule).toEqual(week('09:30', '21:00'));
  });

  it('rejects an invalid timezone or schedule before saving anything', async () => {
    const r = repo();
    const useCase = new CreateRestaurantUseCase(r);

    await expect(useCase.execute({ name: 'A', slug: 'a', timezone: 'Nowhere/Land' })).rejects.toThrow(ValidationError);
    await expect(
      useCase.execute({ name: 'A', slug: 'a', schedule: [{ dayOfWeek: 7, open: '09:00', close: '17:00' }] })
    ).rejects.toThrow(ValidationError);
    expect(r.save).not.toHaveBeenCalled();
  });
});
