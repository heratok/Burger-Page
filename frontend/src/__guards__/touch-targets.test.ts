// @ts-expect-error node types are not installed for the browser tsconfig; vitest runs on Node.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/index.css', 'utf8') as string;

// Production sources only: tests and guards are excluded.
const sources = import.meta.glob(
  ['/src/**/*.tsx', '!/src/**/*.test.tsx', '!/src/__guards__/**'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

const lineOf = (code: string, index: number) => code.slice(0, index).split('\n').length;

/** End index (exclusive) of the JSX opening tag that starts at `start`, honoring `{...}` nesting. */
function openingTagEnd(code: string, start: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < code.length; i++) {
    const ch = code[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (depth > 0) {
      if (ch === '"' || ch === "'" || ch === '`') quote = ch;
      else if (ch === '{') depth++;
      else if (ch === '}') depth--;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '{') depth++;
    else if (ch === '>' && code[i - 1] !== '=') return i + 1;
  }
  return code.length;
}

/** Compact sizing that leaves a control under 44px on touch screens. */
const COMPACT =
  /(?:^|[\s"'`{])(?:py-0\.5|py-1|py-1\.5|py-2|p-0|p-1|p-1\.5|p-2|h-5|h-6|h-7|h-8|h-9|size-5|size-6|size-7|size-8|size-9|min-h-\[3\dpx\]|min-h-9|min-h-10)(?=[\s"'`}])/;
/** Not a flow target: overlays positioned over other content, hidden controls, switches (own hit area). */
const EXEMPT = /(?:^|[\s"'`{])(?:absolute|fixed|sr-only|hidden)(?=[\s"'`}])|role=["']switch["']/;

/**
 * Raw `<button>`s with a compact class must opt in to a 44px touch target (`pointer-coarse:min-h-11`,
 * `pointer-coarse:size-11`, ...). Desktop density stays: the variant only matches coarse pointers.
 * The shared <Button> carries the same variants in its size scale (components/ui/button.tsx).
 */
describe('touch target guard (WCAG 2.5.8)', () => {
  it('scans production sources', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50);
  });

  it('compact raw <button> elements opt in to a 44px coarse-pointer target', () => {
    const offenders: string[] = [];
    for (const [file, code] of Object.entries(sources)) {
      const re = /<button\b/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(code))) {
        const tag = code.slice(m.index, openingTagEnd(code, m.index));
        const cls = /className=(?:"([^"]*)"|\{([\s\S]*)\})/.exec(tag);
        if (!cls) continue;
        const classes = cls[1] ?? cls[2] ?? '';
        if (!COMPACT.test(classes) || EXEMPT.test(tag)) continue;
        if (/pointer-coarse:(?:min-h-11|size-11|h-11)/.test(classes)) continue;
        offenders.push(`${file}:${lineOf(code, m.index)}`);
      }
    }
    expect(
      offenders,
      `compact <button> without pointer-coarse:min-h-11 / size-11:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('keeps the global coarse-pointer hit-area rule and the 24px+ toast close button', () => {
    expect(css).toMatch(/@media \(pointer: coarse\)[\s\S]*?\[role="button"\][\s\S]*?::after[\s\S]*?inset-block/);
    expect(css).toMatch(/\[data-close-button\][\s\S]*?width:\s*(?:2[4-9]|[3-9]\d)px/);
  });

  it('the shared Button scale grows to 44px on coarse pointers', () => {
    const button = readFileSync('src/components/ui/button.tsx', 'utf8') as string;
    for (const size of ['default', 'xs', 'sm', 'lg', 'icon', 'icon-xs', 'icon-sm', 'icon-lg']) {
      const sizes = button.slice(button.indexOf("size: {"));
      const line = new RegExp(`"?\\b${size}"?:\\s*"([^"]*)"`).exec(sizes)?.[1] ?? "";
      expect(line, `Button size "${size}"`).toMatch(/pointer-coarse:(?:min-h-11|size-11)/);
    }
  });
});
