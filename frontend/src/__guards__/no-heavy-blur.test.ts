import { describe, expect, it } from 'vitest';

/**
 * Large CSS blurs (filter: blur) on huge elements are GPU-expensive on low-end phones and can
 * cause paint jank. Ambient glows must use a CSS radial-gradient (zero blur cost) instead.
 * Rule: no `blur-[Npx]` above 64px (Tailwind blur-3xl) and no blur filter on elements sized
 * with an arbitrary dimension of 400px or more. `backdrop-blur-*` on small surfaces is fine.
 */
const sources = import.meta.glob(
  ['/src/**/*.tsx', '/src/**/*.css', '!/src/**/*.test.tsx', '!/src/__guards__/**'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

const lineOf = (code: string, index: number) => code.slice(0, index).split('\n').length;

describe('no heavy blur blobs', () => {
  it('scans production sources', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50);
  });

  it('has no blur filter above 64px', () => {
    const re = /(?<![-\w])blur-\[(\d+)px\]/g;
    const offenders: string[] = [];
    for (const [file, code] of Object.entries(sources)) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(code))) if (Number(m[1]) > 64) offenders.push(`${file}:${lineOf(code, m.index)} ${m[0]}`);
    }
    expect(offenders, `Oversized blur filters (use radial-gradient):\n${offenders.join('\n')}`).toEqual([]);
  });

  it('has no blur filter on large (>=400px) elements', () => {
    const offenders: string[] = [];
    for (const [file, code] of Object.entries(sources)) {
      for (const line of code.split('\n')) {
        if (/(?<![-\w])blur(?:-[\w[\]]+)?(?=[\s"'`])/.test(line) && /\b[hw]-\[(?:[4-9]\d\d|\d{4,})px\]/.test(line)) {
          offenders.push(`${file}: ${line.trim().slice(0, 110)}`);
        }
      }
    }
    expect(offenders, `Large blurred blobs:\n${offenders.join('\n')}`).toEqual([]);
  });
});
