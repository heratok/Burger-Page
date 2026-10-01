import { describe, it, expect } from 'vitest';
import { ID_PATTERN, ID_PREFIX, createUuidV7Generator, isValidId, newId, uuidv7 } from '../../../src/domain/shared/newId.js';

// The same pattern the database enforces on every primary key (T10).
const DB_ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/;

describe('uuidv7', () => {
  it('has the canonical 8-4-4-4-12 shape', () => {
    expect(uuidv7()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('sets the version nibble to 7 and the variant bits to 10', () => {
    for (let i = 0; i < 500; i++) {
      const id = uuidv7();
      expect(id[14]).toBe('7');
      expect(['8', '9', 'a', 'b']).toContain(id[19]);
    }
  });

  it('embeds the unix millisecond timestamp in the first 48 bits', () => {
    const ts = 1_700_000_000_123;
    const id = createUuidV7Generator(() => ts)();
    const embedded = parseInt(id.replace(/-/g, '').slice(0, 12), 16);
    expect(embedded).toBe(ts);
  });

  it('is strictly increasing across calls within the same millisecond', () => {
    const gen = createUuidV7Generator(() => 1_800_000_000_000);
    const ids = Array.from({ length: 3000 }, () => gen());
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i] > ids[i - 1], `${ids[i - 1]} < ${ids[i]}`).toBe(true);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('stays monotonic when the clock goes backwards', () => {
    const times = [1_900_000_000_500, 1_900_000_000_100];
    const gen = createUuidV7Generator(() => times.shift()!);
    const a = gen();
    const b = gen();
    expect(b > a).toBe(true);
  });

  it('sorts by creation time across milliseconds', () => {
    const times = [1_950_000_000_001, 1_950_000_000_002, 1_950_000_000_900];
    const gen = createUuidV7Generator(() => times.shift()!);
    const ids = [gen(), gen(), gen()];
    expect([...ids].sort()).toEqual(ids);
  });

  it('is unique and increasing across a large burst on the real clock', () => {
    const ids = Array.from({ length: 20000 }, () => uuidv7());
    expect([...ids].sort()).toEqual(ids);
  });

  it('is unique across a large burst on the real clock', () => {
    const ids = new Set(Array.from({ length: 20000 }, () => uuidv7()));
    expect(ids.size).toBe(20000);
  });
});

describe('newId', () => {
  it('prefixes the uuidv7 with <prefix>_ and matches the database id format', () => {
    const id = newId('prod');
    expect(id).toMatch(/^prod_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(id).toMatch(DB_ID_REGEX);
    expect(ID_PATTERN.source).toBe(DB_ID_REGEX.source);
  });

  it('every known prefix yields an id the database accepts', () => {
    for (const prefix of Object.values(ID_PREFIX)) {
      const id = newId(prefix);
      expect(id).toMatch(DB_ID_REGEX);
      expect(isValidId(id)).toBe(true);
    }
  });

  it('keeps the established prefixes', () => {
    expect(ID_PREFIX).toMatchObject({
      restaurant: 'rest',
      user: 'usr',
      category: 'cat',
      product: 'prod',
      addition: 'add',
      customer: 'cust',
      order: 'ord',
      orderItem: 'ord_item',
      orderAddition: 'ord_add',
      supplier: 'sup',
      inventory: 'inv',
    });
  });

  it('rejects a prefix that would produce an invalid id', () => {
    expect(() => newId('')).toThrow();
    expect(() => newId('has space')).toThrow();
    expect(() => newId('x'.repeat(40))).toThrow();
  });

  it('orders ids of one prefix by creation', () => {
    const ids = Array.from({ length: 200 }, () => newId('ord'));
    expect([...ids].sort()).toEqual(ids);
  });
});

describe('isValidId', () => {
  it.each(['abc', 'rest-1788579266608', 'ord_item_x-1', 'A'.repeat(64)])('accepts %s', (id) => {
    expect(isValidId(id)).toBe(true);
  });

  it.each(['', 'a b', 'a.b', 'a'.repeat(65), 'a/b', undefined, null, 42])('rejects %s', (id) => {
    expect(isValidId(id as any)).toBe(false);
  });
});
