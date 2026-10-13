import { describe, expect, it } from 'vitest';

/**
 * Palette guard: indigo / violet / purple / fuchsia / pink / cyan gradients are the best-known
 * "generic AI UI" tell. The product's identity is the orange/amber burger brand
 * (--color-accent in index.css); gradients must use that or neutral slate/black scrims.
 * Semantic states keep distinguishability with flat color pairs plus icon/label.
 */
const sources = import.meta.glob(
  ['/src/**/*.tsx', '!/src/**/*.test.tsx', '!/src/__guards__/**'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

const lineOf = (code: string, index: number) => code.slice(0, index).split('\n').length;

describe('palette guard', () => {
  it('scans production sources', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50);
  });

  it('has no indigo/purple/violet/fuchsia/pink/cyan gradient stops', () => {
    const re = /\b(?:from|via|to)-(?:indigo|purple|violet|fuchsia|pink|cyan)-\d+/g;
    const offenders: string[] = [];
    for (const [file, code] of Object.entries(sources)) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(code))) offenders.push(`${file}:${lineOf(code, m.index)} ${m[0]}`);
    }
    expect(offenders, `Off-brand gradient stops (use orange/amber brand or slate):\n${offenders.join('\n')}`).toEqual([]);
  });

  it('does not tint headings with indigo (generic accent tell)', () => {
    const re = /<h[1-4]\b[^>]*className=(?:"[^"]*|\{`[^`]*)\btext-indigo-\d+/g;
    const offenders: string[] = [];
    for (const [file, code] of Object.entries(sources)) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(code))) offenders.push(`${file}:${lineOf(code, m.index)}`);
    }
    expect(offenders, `Indigo headings:\n${offenders.join('\n')}`).toEqual([]);
  });
});
