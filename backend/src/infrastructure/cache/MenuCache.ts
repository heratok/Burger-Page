const DEFAULT_TTL_MS = 30_000;

/**
 * Parses MENU_CACHE_TTL_MS. A non-negative integer is used as is (0 disables the
 * cache); unset, negative, fractional or non-numeric values fall back to 30s.
 */
export function parseMenuCacheTtlMs(raw: string | undefined): number {
  const value = raw?.trim();
  if (!value || !/^\d+$/.test(value)) return DEFAULT_TTL_MS;
  const ttl = Number(value);
  return Number.isSafeInteger(ttl) ? ttl : DEFAULT_TTL_MS;
}

export interface MenuCacheOptions {
  /** Time to live per entry in milliseconds (default 30s, a safety net on top of invalidation). */
  ttlMs?: number;
  /** Hard cap on stored entries; the oldest entry is evicted first (default 500). */
  maxEntries?: number;
  /** Injectable clock for tests. */
  now?: () => number;
}

interface Entry<T> {
  restaurantId: string;
  value: T;
  expiresAt: number;
}

/**
 * Small in-memory TTL cache for the public menu, keyed by restaurant + query.
 *
 * NOTE: the cache is per-process. It is only correct while a single backend
 * instance serves traffic; with several instances an invalidation would not
 * reach the others and they would serve stale menus until the TTL expires.
 */
export class MenuCache<T> {
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;
  private readonly entries = new Map<string, Entry<T>>();
  private readonly versions = new Map<string, number>();

  constructor(options: MenuCacheOptions = {}) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.maxEntries = options.maxEntries ?? 500;
    this.now = options.now ?? Date.now;
  }

  get size(): number {
    return this.entries.size;
  }

  /** Returns a private copy of the cached value, or undefined on a miss/expiry. */
  get(restaurantId: string, queryKey: string): T | undefined {
    const key = this.keyOf(restaurantId, queryKey);
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return structuredClone(entry.value);
  }

  /** Current invalidation version for a restaurant; capture it before reading the source. */
  versionOf(restaurantId: string): number {
    return this.versions.get(restaurantId) ?? 0;
  }

  /**
   * Stores a private copy. When `observedVersion` is given and the restaurant
   * was invalidated since, the write is dropped so a read that raced with a
   * menu write can never re-populate stale data.
   */
  set(restaurantId: string, queryKey: string, value: T, observedVersion?: number): void {
    if (observedVersion !== undefined && observedVersion !== this.versionOf(restaurantId)) return;
    if (this.ttlMs <= 0) return; // caching disabled
    const key = this.keyOf(restaurantId, queryKey);
    this.entries.delete(key); // re-insert so Map order tracks age
    this.entries.set(key, { restaurantId, value: structuredClone(value), expiresAt: this.now() + this.ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value as string;
      this.entries.delete(oldest);
    }
  }

  /** Drops every entry of one restaurant; other restaurants are untouched. */
  invalidate(restaurantId: string): void {
    this.versions.set(restaurantId, this.versionOf(restaurantId) + 1);
    for (const [key, entry] of this.entries) {
      if (entry.restaurantId === restaurantId) this.entries.delete(key);
    }
  }

  private keyOf(restaurantId: string, queryKey: string): string {
    return `${restaurantId}\u0000${queryKey}`;
  }
}
