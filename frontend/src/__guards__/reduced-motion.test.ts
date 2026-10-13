// @ts-expect-error node types are not installed for the browser tsconfig; vitest runs on Node.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// vitest stubs CSS modules, so read the stylesheet from disk.
const css = readFileSync('src/index.css', 'utf8') as string;

/** Extracts the bodies of every `@media (prefers-reduced-motion: reduce) { ... }` block. */
function reducedMotionBlocks(source: string): string[] {
  const blocks: string[] = [];
  const re = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{/g;
  while (re.exec(source)) {
    let depth = 1;
    let i = re.lastIndex;
    while (i < source.length && depth > 0) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') depth--;
      i++;
    }
    blocks.push(source.slice(re.lastIndex, i - 1));
  }
  return blocks;
}

describe('reduced motion policy', () => {
  const blocks = reducedMotionBlocks(css);

  it('declares an intentional prefers-reduced-motion block', () => {
    expect(blocks.length).toBeGreaterThan(0);
  });

  it('has no blanket !important duration kill', () => {
    for (const block of blocks) {
      expect(block).not.toMatch(/(animation|transition)-duration:[^;]*!important/);
      expect(block).not.toMatch(/animation-iteration-count:[^;]*!important/);
      expect(block).not.toMatch(/0\.001ms/);
    }
  });

  it('keeps scroll-behavior auto under reduce', () => {
    expect(blocks.join('\n')).toMatch(/scroll-behavior:\s*auto/);
  });

  it('replaces enter/exit animations with an opacity-only fade', () => {
    const joined = blocks.join('\n');
    expect(joined).toMatch(/animate-in/);
    expect(joined).toMatch(/animate-out/);
    expect(joined).toMatch(/animation-name:\s*rm-fade-in/);
    expect(joined).toMatch(/animation-name:\s*rm-fade-out/);
  });
});

const tsSources = import.meta.glob(
  ['/src/**/*.ts', '/src/**/*.tsx', '!/src/**/*.test.*', '!/src/__guards__/**', '!/src/lib/motion.ts'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

describe('JS-driven smooth scrolling', () => {
  it('never hardcodes behavior: "smooth" (use scrollBehavior() from lib/motion)', () => {
    const offenders = Object.entries(tsSources)
      .filter(([, code]) => /behavior:\s*['"]smooth['"]/.test(code))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });
});
