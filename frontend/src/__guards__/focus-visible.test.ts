import { describe, expect, it } from 'vitest';

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

/** The JSX opening tag containing `index`, or the surrounding block of non-blank lines for class constants. */
function contextAround(code: string, index: number): string {
  const tagStart = code.lastIndexOf('<', index);
  if (tagStart !== -1 && /^<[A-Za-z]/.test(code.slice(tagStart, tagStart + 2))) {
    const end = openingTagEnd(code, tagStart);
    if (end > index) return code.slice(tagStart, end);
  }
  const before = code.slice(0, index).split('\n');
  const after = code.slice(index).split('\n');
  const up: string[] = [];
  for (let i = before.length - 1; i >= 0 && up.length < 12 && before[i].trim() !== ''; i--) up.unshift(before[i]);
  const down: string[] = [after[0]];
  for (let i = 1; i < after.length && down.length < 12 && after[i].trim() !== ''; i++) down.push(after[i]);
  return [...up, ...down].join('\n');
}

/** Any class that paints a keyboard-focus indicator (ring, border, shadow, outline, or the .focus-ring utility). */
const INDICATOR =
  /(?:^|[\s"'`])(?:(?:focus|focus-visible|focus-within|group-focus-visible|peer-focus-visible):(?:ring|border|shadow|outline-(?!none\b)|underline)|has-\[\S*focus-visible\S*:(?:ring|border)|focus-ring\b)/;

/**
 * Files whose bare outline-none is justified:
 * - dialog.tsx: the popup is a non-interactive container that base-ui focuses programmatically.
 */
const ALLOWLIST = new Set(['/src/components/ui/dialog.tsx']);

describe('focus-visible guard', () => {
  it('scans production sources', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50);
  });

  it('every outline-none keeps a visible keyboard focus indicator', () => {
    const offenders: string[] = [];
    const re = /(?<![\w-])((?:focus|focus-visible):)?outline-none\b/g;
    for (const [file, code] of Object.entries(sources)) {
      if (ALLOWLIST.has(file)) continue;
      let m: RegExpExecArray | null;
      while ((m = re.exec(code))) {
        const ctx = contextAround(code, m.index);
        // Programmatic focus targets (tabIndex -1, e.g. the skip-link target) are not keyboard stops.
        if (/tabIndex=\{-1\}/.test(ctx)) continue;
        if (INDICATOR.test(ctx)) continue;
        // Control inside a bordered wrapper that paints focus-within (wrapper opens within the 15 preceding lines).
        const preceding = code.slice(0, code.indexOf(ctx)).split('\n').slice(-15).join('\n');
        if (/focus-within:(?:ring|border)/.test(preceding) && /<(?:input|textarea|select|Input\w*|Textarea)\b/i.test(ctx)) continue;
        offenders.push(`${file}:${lineOf(code, m.index)}`);
      }
    }
    expect(
      offenders,
      `outline-none without focus:ring/focus-visible:ring/border/outline/focus-within replacement:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('never applies a variant to the .focus-ring utility (it is plain CSS and would generate nothing)', () => {
    const offenders: string[] = [];
    for (const [file, code] of Object.entries(sources)) {
      const re = /[a-z-]+:focus-ring\b/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(code))) offenders.push(`${file}:${lineOf(code, m.index)}`);
    }
    expect(offenders).toEqual([]);
  });
});
