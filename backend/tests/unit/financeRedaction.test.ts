import { describe, it, expect } from 'vitest';
import type { FastifyRequest } from 'fastify';
import { canViewFinance, omitCostForNonFinance, redactInventoryItem } from '../../src/infrastructure/http/financeRedaction.js';

const reqWith = (permissions?: string[]) =>
  ({ authContext: permissions ? { permissions } : undefined }) as unknown as FastifyRequest;

describe('finance redaction helpers', () => {
  it('canViewFinance reads finance.view from the resolved session permissions', () => {
    expect(canViewFinance(reqWith(['finance.view']))).toBe(true);
    expect(canViewFinance(reqWith(['inventory.manage']))).toBe(false);
    expect(canViewFinance(reqWith())).toBe(false);
  });

  it('redactInventoryItem drops costPerUnit unless finance is allowed', () => {
    const item = { id: 'i', name: 'Pan', quantity: 3, costPerUnit: 1200 };
    expect(redactInventoryItem(item, false)).toEqual({ id: 'i', name: 'Pan', quantity: 3 });
    expect(redactInventoryItem(item, true)).toEqual(item);
  });

  it('omitCostForNonFinance strips the cost from a write body but keeps the rest', () => {
    expect(omitCostForNonFinance({ name: 'x', costPerUnit: 5 }, false)).toEqual({ name: 'x' });
    expect(omitCostForNonFinance({ name: 'x', costPerUnit: 5 }, true)).toEqual({ name: 'x', costPerUnit: 5 });
  });
});
