import { describe, it, expect } from 'vitest';
import { MenuCache } from '../../../src/infrastructure/cache/MenuCache.js';

function makeCache(opts: { ttlMs?: number; maxEntries?: number } = {}) {
  let now = 1_000;
  const cache = new MenuCache<{ items: number[] }>({ ...opts, now: () => now });
  return { cache, advance: (ms: number) => (now += ms) };
}

describe('MenuCache', () => {
  it('returns undefined on a miss and the stored value on a hit', () => {
    const { cache } = makeCache();
    expect(cache.get('r1', 'all')).toBeUndefined();
    cache.set('r1', 'all', { items: [1] });
    expect(cache.get('r1', 'all')).toEqual({ items: [1] });
  });

  it('expires entries after the TTL (default 30s)', () => {
    const { cache, advance } = makeCache();
    cache.set('r1', 'all', { items: [1] });
    advance(29_999);
    expect(cache.get('r1', 'all')).toBeDefined();
    advance(1);
    expect(cache.get('r1', 'all')).toBeUndefined();
  });

  it('honors a custom TTL', () => {
    const { cache, advance } = makeCache({ ttlMs: 100 });
    cache.set('r1', 'all', { items: [1] });
    advance(100);
    expect(cache.get('r1', 'all')).toBeUndefined();
  });

  it('keeps restaurants and query keys isolated', () => {
    const { cache } = makeCache();
    cache.set('r1', 'all', { items: [1] });
    cache.set('r2', 'all', { items: [2] });
    cache.set('r1', 'p=1&l=10', { items: [3] });
    expect(cache.get('r1', 'all')).toEqual({ items: [1] });
    expect(cache.get('r2', 'all')).toEqual({ items: [2] });
    expect(cache.get('r1', 'p=1&l=10')).toEqual({ items: [3] });
  });

  it('invalidates only the given restaurant', () => {
    const { cache } = makeCache();
    cache.set('r1', 'all', { items: [1] });
    cache.set('r1', 'p=1&l=10', { items: [3] });
    cache.set('r2', 'all', { items: [2] });
    cache.invalidate('r1');
    expect(cache.get('r1', 'all')).toBeUndefined();
    expect(cache.get('r1', 'p=1&l=10')).toBeUndefined();
    expect(cache.get('r2', 'all')).toEqual({ items: [2] });
  });

  it('never shares mutable objects between callers', () => {
    const { cache } = makeCache();
    const original = { items: [1] };
    cache.set('r1', 'all', original);
    original.items.push(99);
    const first = cache.get('r1', 'all')!;
    first.items.push(42);
    expect(cache.get('r1', 'all')).toEqual({ items: [1] });
  });

  it('bounds memory by evicting the oldest entry past maxEntries', () => {
    const { cache } = makeCache({ maxEntries: 2 });
    cache.set('r1', 'a', { items: [1] });
    cache.set('r1', 'b', { items: [2] });
    cache.set('r1', 'c', { items: [3] });
    expect(cache.size).toBe(2);
    expect(cache.get('r1', 'a')).toBeUndefined();
    expect(cache.get('r1', 'c')).toEqual({ items: [3] });
  });

  it('drops a write computed before an invalidation (read/write race)', () => {
    const { cache } = makeCache();
    const observed = cache.versionOf('r1');
    cache.invalidate('r1');
    cache.set('r1', 'all', { items: [1] }, observed);
    expect(cache.get('r1', 'all')).toBeUndefined();
    cache.set('r1', 'all', { items: [2] }, cache.versionOf('r1'));
    expect(cache.get('r1', 'all')).toEqual({ items: [2] });
  });
});
