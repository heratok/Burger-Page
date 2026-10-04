import { describe, it, expect, vi } from 'vitest';
import { GetPlatformStatsUseCase } from '../../../src/application/use-cases/GetPlatformStatsUseCase.js';
import type { PlatformStatsRepository } from '../../../src/domain/ports/out/PlatformStatsRepository.js';
import { ValidationError } from '../../../src/domain/errors/DomainErrors.js';

const STATS = { totalRevenue: 1500.5, totalOrders: 3, totalCustomers: 2, totalRestaurants: 4, activeRestaurants: 3 };

function setup() {
  const repo: PlatformStatsRepository = { get: vi.fn().mockResolvedValue(STATS) };
  return { repo, useCase: new GetPlatformStatsUseCase(repo) };
}

describe('GetPlatformStatsUseCase', () => {
  it('returns what the repository reports, unfiltered by default', async () => {
    const { repo, useCase } = setup();
    await expect(useCase.execute()).resolves.toEqual(STATS);
    expect(repo.get).toHaveBeenCalledWith({});
  });

  it('turns `from` into an inclusive UTC start-of-day bound', async () => {
    const { repo, useCase } = setup();
    await useCase.execute({ from: '2026-01-15' });
    expect(repo.get).toHaveBeenCalledWith({ ordersFrom: '2026-01-15T00:00:00.000Z' });
  });

  it('turns `to` into an exclusive bound at the start of the NEXT day, so the whole last day counts', async () => {
    const { repo, useCase } = setup();
    await useCase.execute({ to: '2026-01-31' });
    expect(repo.get).toHaveBeenCalledWith({ ordersBefore: '2026-02-01T00:00:00.000Z' });
  });

  it('rolls the exclusive bound over month and year ends', async () => {
    const { repo, useCase } = setup();
    await useCase.execute({ to: '2026-12-31' });
    expect(repo.get).toHaveBeenLastCalledWith({ ordersBefore: '2027-01-01T00:00:00.000Z' });
    await useCase.execute({ to: '2028-02-28' });
    expect(repo.get).toHaveBeenLastCalledWith({ ordersBefore: '2028-02-29T00:00:00.000Z' });
  });

  it('accepts a single-day range', async () => {
    const { repo, useCase } = setup();
    await useCase.execute({ from: '2026-03-05', to: '2026-03-05' });
    expect(repo.get).toHaveBeenCalledWith({
      ordersFrom: '2026-03-05T00:00:00.000Z',
      ordersBefore: '2026-03-06T00:00:00.000Z',
    });
  });

  it('rejects a reversed range before touching storage', async () => {
    const { repo, useCase } = setup();
    await expect(useCase.execute({ from: '2026-02-01', to: '2026-01-31' })).rejects.toBeInstanceOf(ValidationError);
    expect(repo.get).not.toHaveBeenCalled();
  });
});
