import type { MenuCacheOptions } from './MenuCache.js';

const DEFAULT_TTL_MS = 30_000;

/**
 * Small in-memory TTL cache mapping a public restaurant identifier (id or slug,
 * namespaced by the caller, e.g. `slug:alpha`) to the resolved restaurant id.
 * Only positive, active results are stored: "not found" and inactive tenants
 * are never cached, so they keep failing fresh on every request.
 *
 * NOTE: the cache is per-process. It is only correct while a single backend
 * instance serves traffic; with several instances an invalidation would not
 * reach the others and they would keep resolving a renamed, deactivated or
 * deleted tenant until the TTL expires.
 */
export class RestaurantIdCache {
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;
  private readonly entries = new Map<string, { restaurantId: string; expiresAt: number }>();
  private versionCounter = 0;

  constructor(options: MenuCacheOptions = {}) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.maxEntries = options.maxEntries ?? 500;
    this.now = options.now ?? Date.now;
  }

  get size(): number {
    return this.entries.size;
  }

  /** Invalidation version; capture it before the repository lookup and pass it to set(). */
  get version(): number {
    return this.versionCounter;
  }

  get(key: string): string | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.restaurantId;
  }

  /** Dropped when an invalidation happened since `observedVersion`, so a racing lookup cannot store stale data. */
  set(key: string, restaurantId: string, observedVersion?: number): void {
    if (observedVersion !== undefined && observedVersion !== this.versionCounter) return;
    if (this.ttlMs <= 0) return; // caching disabled
    this.entries.delete(key); // re-insert so Map order tracks age
    this.entries.set(key, { restaurantId, expiresAt: this.now() + this.ttlMs });
    while (this.entries.size > this.maxEntries) {
      this.entries.delete(this.entries.keys().next().value as string);
    }
  }

  /** Drops every entry resolving to `restaurantId` plus any extra keys known by the caller. */
  invalidate(restaurantId: string, ...keys: string[]): void {
    this.versionCounter++;
    for (const key of keys) this.entries.delete(key);
    for (const [key, entry] of this.entries) {
      if (entry.restaurantId === restaurantId) this.entries.delete(key);
    }
  }

  /** Drops everything; used when the affected restaurant id is not known (e.g. delete by slug). */
  clear(): void {
    this.versionCounter++;
    this.entries.clear();
  }
}
