import { describe, it, expect } from 'vitest';
import { LoginThrottle } from '../../../src/application/services/LoginThrottle.js';

describe('LoginThrottle', () => {
  it('locks a key after maxFailures inside the window and unlocks after lockMs', () => {
    let now = 0;
    const throttle = new LoginThrottle({ maxFailures: 2, windowMs: 1000, lockMs: 5000, now: () => now });
    throttle.recordFailure('a');
    expect(throttle.lockedFor('a')).toBe(0);
    throttle.recordFailure('a');
    expect(throttle.lockedFor('a')).toBe(5);
    now = 5001;
    expect(throttle.lockedFor('a')).toBe(0);
  });

  it('forgets failures older than the window', () => {
    let now = 0;
    const throttle = new LoginThrottle({ maxFailures: 2, windowMs: 1000, lockMs: 5000, now: () => now });
    throttle.recordFailure('a');
    now = 2000;
    throttle.recordFailure('a');
    expect(throttle.lockedFor('a')).toBe(0);
  });

  it('never evicts an active lock when the map is full of other keys', () => {
    const throttle = new LoginThrottle({ maxFailures: 1, windowMs: 1000, lockMs: 60_000, maxEntries: 3, now: () => 0 });
    throttle.recordFailure('victim');
    for (let i = 0; i < 50; i++) throttle.recordFailure(`random-${i}`);
    expect(throttle.lockedFor('victim')).toBeGreaterThan(0);
  });
});
