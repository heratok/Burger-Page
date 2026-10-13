import { describe, expect, it } from 'vitest';

/**
 * `truncate` (overflow hidden + ellipsis + nowrap) hides part of user-meaningful values
 * (names, emails, addresses, order lines) from sighted keyboard/touch users: the full text is
 * still in the DOM but cannot be read. Such values must wrap (`break-words`, optionally
 * `line-clamp-N`) instead.
 *
 * Triage rule: an element that renders a dynamic value (`{expr}`) must not use `truncate`
 * unless the file/line is in ALLOWED (UI chrome or already-scrollable controls whose full
 * value is exposed elsewhere, documented per entry). Fixed-width `truncate max-w-[Npx]` is
 * never allowed.
 */
const sources = import.meta.glob(
  ['/src/**/*.tsx', '!/src/**/*.test.tsx', '!/src/__guards__/**'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

const lineOf = (code: string, index: number) => code.slice(0, index).split('\n').length;

/** Opening tags carrying the `truncate` utility, with the text up to the next closing tag. */
function truncatedElements(code: string) {
  const out: { index: number; open: string; body: string }[] = [];
  const re = /<([A-Za-z][\w.]*)\b[^<>]*?(?<![-\w])truncate(?![-\w])[^<>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    const end = m.index + m[0].length;
    const close = code.indexOf(`</${m[1]}>`, end);
    out.push({ index: m.index, open: m[0], body: close === -1 ? '' : code.slice(end, close) });
  }
  return out;
}

/** UI chrome / controls where ellipsis is acceptable. Keep this list short and justified. */
const ALLOWED = [
  // Select/combobox trigger and option rows: the full value is the control's accessible name and the
  // listbox is scrollable; width is governed by the form layout.
  '/src/components/ui/ModernSelect.tsx',
  // Admin sidebar/breadcrumb chrome: single-line header strip (h-14) where wrapping would break the shell.
  '/src/features/crm/AdminLayout.tsx',
  // Static customizer labels/descriptions (not user data).
  '/src/features/crm/customizer/',
  // Upload status chip inside a fixed-size image preview (static strings, file name is also shown in the form).
  '/src/features/crm/menu/ProductModal.tsx:chip',
];

describe('no truncated user data', () => {
  it('scans production sources', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50);
  });

  it('never truncates with a fixed pixel max-width', () => {
    const offenders: string[] = [];
    for (const [file, code] of Object.entries(sources)) {
      for (const el of truncatedElements(code)) {
        if (/max-w-\[\d+px\]/.test(el.open)) offenders.push(`${file}:${lineOf(code, el.index)}`);
      }
    }
    expect(offenders, `truncate + max-w-[Npx] (use break-words / line-clamp):\n${offenders.join('\n')}`).toEqual([]);
  });

  it('does not truncate dynamic values outside the allowlist', () => {
    const offenders: string[] = [];
    for (const [file, code] of Object.entries(sources)) {
      if (ALLOWED.some((a) => file.includes(a.split(':')[0]))) continue;
      for (const el of truncatedElements(code)) {
        const dynamic = /\{(?!\s*\/\*)[^}]*[A-Za-z_.]+[^}]*\}/.test(el.body);
        if (dynamic) offenders.push(`${file}:${lineOf(code, el.index)}`);
      }
    }
    expect(offenders, `Dynamic values using truncate (use break-words / line-clamp-N):\n${offenders.join('\n')}`).toEqual([]);
  });
});
