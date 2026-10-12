import { MAX_BULK_TABLES, formatTableName } from '@burger-page/contracts';
import { ID_PREFIX, newId } from '../../domain/shared/newId.js';
import { RestaurantTableRepository } from '../../domain/ports/out/RestaurantTableRepository.js';
import { RestaurantTable, tableIdentityKey } from '../../domain/models/RestaurantTable.js';
import { ValidationError } from '../../domain/errors/DomainErrors.js';
import { validateTableNumber, validateTableZone } from './tableIdentity.js';

export interface BulkCreateRestaurantTablesInput {
  zone: string;
  from: number;
  to: number;
  isActive?: boolean;
}

export interface BulkCreateRestaurantTablesResult {
  created: RestaurantTable[];
  /** Numbers of the range that already existed in the zone and were left untouched. */
  skipped: number[];
}

export class BulkCreateRestaurantTablesUseCase {
  constructor(private tableRepo: RestaurantTableRepository) {}

  /** Creates zone numbers from..to in one transaction, skipping the ones that already exist. */
  async execute(restaurantId: string, input: BulkCreateRestaurantTablesInput): Promise<BulkCreateRestaurantTablesResult> {
    const zone = validateTableZone(input.zone);
    const from = validateTableNumber(input.from, 'El número inicial');
    const to = validateTableNumber(input.to, 'El número final');
    if (from > to) {
      throw new ValidationError('El número inicial no puede ser mayor que el final');
    }
    if (to - from + 1 > MAX_BULK_TABLES) {
      throw new ValidationError(`No se pueden crear más de ${MAX_BULK_TABLES} mesas a la vez`);
    }

    const existing = await this.tableRepo.findByRestaurantId(restaurantId);
    const taken = new Set(existing.map((t) => tableIdentityKey(t.zone, t.number)));
    let sortOrder = existing.reduce((max, t) => Math.max(max, t.sortOrder), -1) + 1;

    const now = new Date().toISOString();
    const created: RestaurantTable[] = [];
    const skipped: number[] = [];
    for (let number = from; number <= to; number += 1) {
      if (taken.has(tableIdentityKey(zone, number))) {
        skipped.push(number);
        continue;
      }
      created.push({
        id: newId(ID_PREFIX.table),
        restaurantId,
        zone,
        number,
        alias: null,
        name: formatTableName({ zone, number }),
        sortOrder: sortOrder++,
        isActive: input.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (created.length > 0) {
      await this.tableRepo.saveMany(created);
    }
    return { created, skipped };
  }
}
