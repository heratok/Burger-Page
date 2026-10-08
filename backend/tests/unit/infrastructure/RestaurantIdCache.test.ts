import { describe, it, expect } from 'vitest';
import { RestaurantIdCache } from '../../../src/infrastructure/cache/RestaurantIdCache.js';

function clock(start = 1_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe('RestaurantIdCache', () => {
  it('returns a stored id until the TTL expires', () => {
    const c = clock();
    const cache = new RestaurantIdCache({ ttlMs: 100, now: c.now });
    cache.set('slug:alpha', 'rest-a');
    expect(cache.get('slug:alpha')).toBe('rest-a');
    c.advance(100);
    expect(cache.get('slug:alpha')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('is disabled with ttl 0', () => {
    const cache = new RestaurantIdCache({ ttlMs: 0 });
    cache.set('slug:alpha', 'rest-a');
    expect(cache.get('slug:alpha')).toBeUndefined();
  });

  it('evicts the oldest entry beyond maxEntries', () => {
    const cache = new RestaurantIdCache({ maxEntries: 2 });
    cache.set('slug:a', 'ra');
    cache.set('slug:b', 'rb');
    cache.set('slug:c', 'rc');
    expect(cache.get('slug:a')).toBeUndefined();
    expect(cache.get('slug:c')).toBe('rc');
  });

  it('invalidate drops every entry resolving to the restaurant plus extra keys, nothing else', () => {
    const cache = new RestaurantIdCache();
    cache.set('slug:alpha', 'rest-a');
    cache.set('id:rest-a', 'rest-a');
    cache.set('slug:beta', 'rest-b');
    cache.set('slug:other', 'rest-c');
    cache.invalidate('rest-a', 'slug:other');
    expect(cache.get('slug:alpha')).toBeUndefined();
    expect(cache.get('id:rest-a')).toBeUndefined();
    expect(cache.get('slug:other')).toBeUndefined();
    expect(cache.get('slug:beta')).toBe('rest-b');
  });

  it('drops a set made with a version captured before an invalidation', () => {
    const cache = new RestaurantIdCache();
    const version = cache.version;
    cache.invalidate('rest-a');
    cache.set('slug:alpha', 'rest-a', version);
    expect(cache.get('slug:alpha')).toBeUndefined();
  });

  it('clear empties the cache and bumps the version', () => {
    const cache = new RestaurantIdCache();
    cache.set('slug:alpha', 'rest-a');
    const v = cache.version;
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.version).toBe(v + 1);
  });
});
