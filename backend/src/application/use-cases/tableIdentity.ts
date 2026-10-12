import {
  MAX_TABLE_ALIAS_LENGTH,
  MAX_TABLE_NUMBER,
  MAX_TABLE_ZONE_LENGTH,
  MIN_TABLE_NUMBER,
  formatTableName,
  normalizeTableAlias,
  normalizeTableZone,
} from '@burger-page/contracts';
import { ValidationError } from '../../domain/errors/DomainErrors.js';

export interface TableIdentity {
  zone: string;
  number: number;
  alias: string | null;
  name: string;
}

export function validateTableZone(raw: string | undefined): string {
  const zone = normalizeTableZone(raw ?? '');
  if (!zone) {
    throw new ValidationError('La zona de la mesa es obligatoria');
  }
  if (zone.length > MAX_TABLE_ZONE_LENGTH) {
    throw new ValidationError(`La zona no puede superar ${MAX_TABLE_ZONE_LENGTH} caracteres`);
  }
  return zone;
}

export function validateTableNumber(raw: number | undefined, label = 'El número de mesa'): number {
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < MIN_TABLE_NUMBER || raw > MAX_TABLE_NUMBER) {
    throw new ValidationError(`${label} debe estar entre ${MIN_TABLE_NUMBER} y ${MAX_TABLE_NUMBER}`);
  }
  return raw;
}

export function validateTableAlias(raw: string | null | undefined): string | null {
  const alias = normalizeTableAlias(raw);
  if (alias && alias.length > MAX_TABLE_ALIAS_LENGTH) {
    throw new ValidationError(`El alias no puede superar ${MAX_TABLE_ALIAS_LENGTH} caracteres`);
  }
  return alias;
}

/** Validates and normalizes zone/number/alias and derives the table name; shared by create and update. */
export function buildTableIdentity(input: { zone?: string; number?: number; alias?: string | null }): TableIdentity {
  const zone = validateTableZone(input.zone);
  const number = validateTableNumber(input.number);
  const alias = validateTableAlias(input.alias);
  return { zone, number, alias, name: formatTableName({ zone, number, alias }) };
}
