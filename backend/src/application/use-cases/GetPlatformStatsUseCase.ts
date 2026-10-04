import type { PlatformStatsQuery } from '@burger-page/contracts';
import { PlatformStats, PlatformStatsFilter } from '../../domain/models/PlatformStats.js';
import { PlatformStatsRepository } from '../../domain/ports/out/PlatformStatsRepository.js';
import { ValidationError } from '../../domain/errors/DomainErrors.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDayUtc = (date: string) => new Date(`${date}T00:00:00.000Z`);

/** Platform-wide totals for the super admin; the caller (route guard) decides who may ask. */
export class GetPlatformStatsUseCase {
  constructor(private readonly repo: PlatformStatsRepository) {}

  async execute(query: PlatformStatsQuery = {}): Promise<PlatformStats> {
    if (query.from && query.to && query.from > query.to) {
      throw new ValidationError('`from` must not be after `to`');
    }
    const filter: PlatformStatsFilter = {};
    if (query.from) filter.ordersFrom = startOfDayUtc(query.from).toISOString();
    if (query.to) {
      // `to` is an inclusive calendar day: count up to the start of the next one.
      filter.ordersBefore = new Date(startOfDayUtc(query.to).getTime() + DAY_MS).toISOString();
    }
    return this.repo.get(filter);
  }
}
