/**
 * Per-account brute-force guard for the login (complements the per-IP rate
 * limit, which an attacker spreading requests across addresses never hits).
 *
 * After `maxFailures` failed attempts against the same key inside `windowMs`,
 * the key is locked for `lockMs`: every attempt, correct password included, is
 * refused until the lock expires. A success resets the key.
 *
 * Per-process state, like the menu cache: valid for a single backend instance
 * (a restart or a second instance starts with a clean slate). Memory is bounded
 * by `maxEntries`, so spraying random usernames cannot grow it without limit.
 */
export interface LoginThrottleOptions {
  maxFailures?: number;
  windowMs?: number;
  lockMs?: number;
  maxEntries?: number;
  now?: () => number;
}

interface Entry {
  failures: number;
  windowStart: number;
  lockedUntil: number;
}

export class LoginThrottle {
  private readonly entries = new Map<string, Entry>();
  private readonly maxFailures: number;
  private readonly windowMs: number;
  private readonly lockMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(options: LoginThrottleOptions = {}) {
    this.maxFailures = options.maxFailures ?? 10;
    this.windowMs = options.windowMs ?? 15 * 60_000;
    this.lockMs = options.lockMs ?? 15 * 60_000;
    this.maxEntries = options.maxEntries ?? 10_000;
    this.now = options.now ?? Date.now;
  }

  /** Seconds left on the lock of the first locked key, or 0 when none is locked. */
  lockedFor(...keys: string[]): number {
    const now = this.now();
    for (const key of keys) {
      const entry = this.entries.get(key);
      if (entry && entry.lockedUntil > now) return Math.ceil((entry.lockedUntil - now) / 1000);
    }
    return 0;
  }

  recordFailure(...keys: string[]): void {
    const now = this.now();
    for (const key of keys) {
      let entry = this.entries.get(key);
      if (!entry || now - entry.windowStart > this.windowMs) {
        if (!entry && !this.makeRoom(now)) continue;
        entry = { failures: 0, windowStart: now, lockedUntil: entry?.lockedUntil ?? 0 };
        this.entries.set(key, entry);
      }
      entry.failures += 1;
      if (entry.failures >= this.maxFailures) {
        entry.lockedUntil = now + this.lockMs;
        entry.failures = 0;
        entry.windowStart = now;
      }
    }
  }

  reset(...keys: string[]): void {
    for (const key of keys) this.entries.delete(key);
  }

  /**
   * Frees a slot for a new key. Expired entries go first, then the oldest
   * unlocked ones; an active lock is never evicted, so flooding the map with
   * random usernames cannot lift the lock on a real account.
   */
  private makeRoom(now: number): boolean {
    if (this.entries.size < this.maxEntries) return true;
    for (const [key, entry] of this.entries) {
      if (entry.lockedUntil <= now && now - entry.windowStart > this.windowMs) this.entries.delete(key);
    }
    for (const [key, entry] of this.entries) {
      if (this.entries.size < this.maxEntries) break;
      if (entry.lockedUntil <= now) this.entries.delete(key);
    }
    return this.entries.size < this.maxEntries;
  }
}
