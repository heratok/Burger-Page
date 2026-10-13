import { afterEach, describe, expect, it, vi } from 'vitest';
import { prefersReducedMotion, scrollBehavior } from './motion';

function mockMatchMedia(matches: boolean) {
  const fn = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? matches : false,
    media: query,
  }));
  vi.stubGlobal('matchMedia', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('motion helpers', () => {
  it('detects the reduce preference', () => {
    const mm = mockMatchMedia(true);
    expect(prefersReducedMotion()).toBe(true);
    expect(mm).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });

  it('is false with no preference', () => {
    mockMatchMedia(false);
    expect(prefersReducedMotion()).toBe(false);
  });

  it('is false when matchMedia is unavailable (SSR / jsdom)', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(prefersReducedMotion()).toBe(false);
  });

  it('scrollBehavior is auto under reduce and smooth otherwise', () => {
    mockMatchMedia(true);
    expect(scrollBehavior()).toBe('auto');
    mockMatchMedia(false);
    expect(scrollBehavior()).toBe('smooth');
  });
});
