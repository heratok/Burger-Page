import { describe, expect, it } from 'vitest';

// Any arbitrary text size below 12px (text-[9px], text-[10px], text-[11px], ...).
const TINY_TEXT = /text-\[(?:[0-9]|1[01])(?:\.\d+)?px\]/g;

// Production sources only: tests and this guard are excluded.
const sources = import.meta.glob(
  ['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}', '!/src/__guards__/**'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

describe('typography floor', () => {
  it('scans production sources', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50);
  });

  it('has no arbitrary text size below 12px in production code', () => {
    const offenders = Object.entries(sources)
      .map(([file, code]) => [file, code.match(TINY_TEXT)?.length ?? 0] as const)
      .filter(([, count]) => count > 0)
      .map(([file, count]) => `${file}: ${count}x`);
    expect(offenders, `Tiny text found (use text-xs or larger):\n${offenders.join('\n')}`).toEqual([]);
  });
});
