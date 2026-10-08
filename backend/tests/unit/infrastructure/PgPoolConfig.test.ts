import { describe, it, expect } from 'vitest';
import { parsePoolMax } from '../../../src/infrastructure/persistence/postgres/poolConfig.js';

describe('parsePoolMax', () => {
  it('defaults to 10 when unset or empty', () => {
    expect(parsePoolMax(undefined)).toBe(10);
    expect(parsePoolMax('')).toBe(10);
    expect(parsePoolMax('   ')).toBe(10);
  });

  it('accepts positive integers', () => {
    expect(parsePoolMax('25')).toBe(25);
    expect(parsePoolMax(' 7 ')).toBe(7);
  });

  it('clamps to 1..100', () => {
    expect(parsePoolMax('500')).toBe(100);
    expect(parsePoolMax('100')).toBe(100);
    expect(parsePoolMax('1')).toBe(1);
  });

  it('falls back to the default for invalid values', () => {
    for (const bad of ['0', '-5', '1.5', 'abc', '10abc', 'NaN', 'Infinity', '1e2']) {
      expect(parsePoolMax(bad)).toBe(10);
    }
  });
});
