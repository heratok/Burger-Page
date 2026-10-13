import { describe, expect, it } from 'vitest';

// WCAG 1.4.3 (AA): muted greys 300/400 fail 4.5:1 on white and light tints.
// A class string that uses them un-prefixed applies in LIGHT mode, so a
// `dark:` pair does not make it safe. Use slate-500 or darker on light surfaces.
const LIGHT_FAILING = /(?<![\w:-])(placeholder:)?text-(?:slate|gray|zinc|neutral|stone)-(?:300|400)(?![\w-])/g;
// Very transparent text colors also fall under 4.5:1 (e.g. text-slate-500/60).
const LOW_ALPHA = /(?<![\w:-])text-(?:slate|gray|zinc|neutral|stone)-(?:500|600|700)\/(?:[1-6]\d?)(?![\w-])/g;

// Status/brand hues that fall under 4.5:1 as text on white or light tints
// (e.g. emerald-600 3.7, amber-600 3.2, orange-600 3.6, indigo-500 4.0, red-500 3.8).
const LIGHT_FAILING_HUE =
  /(?<![\w:-])(placeholder:)?text-(?:(?:red|rose|pink|fuchsia|purple|violet|indigo|blue)-(?:300|400|500)|(?:sky|cyan|teal|emerald|green|lime|amber|orange|yellow)-(?:300|400|500|600))(?:\/\d+)?(?![\w-])/g;
// White text on a solid mid-tone fill: needs bg-*-600 (cool hues) or bg-*-700 (warm/green hues).
const WHITE_ON_FILL =
  /(?<![\w:-])bg-(?:(?:red|rose|pink|fuchsia|purple|violet|indigo|blue)-(?:300|400|500)|(?:sky|cyan|teal|emerald|green|lime|amber|orange|yellow)-(?:300|400|500|600))(?:\/(?:[7-9]\d|100))?(?![\w/-])/g;
// slate-500 is 4.76:1 on white but only 4.34:1 on slate-100/200 tints: use slate-600 there.
const SLATE_500_TEXT = /(?<![\w:-])text-slate-500(?![\w/-])/g;
const SLATE_TINT_BG = /(?<![\w:-])bg-(?:slate|gray|zinc)-(?:100|200)(?![\w/-])/;
const TEXT_WHITE = /(?<![\w:-])text-white(?![\w-])/;

// The class string itself paints a dark surface, so light greys are correct there.
const DARK_SURFACE_IN_STRING =
  /(?<![\w:-])bg-(?:black|(?:slate|gray|zinc|neutral|stone)-(?:700|800|900|950)|[a-z]+-(?:700|800|900|950))(?:\/(?:[7-9]\d|100))?(?![\w/-])/;
// The literal is the dark branch of an `isDark ? "..." : "..."` ternary or `isDark && "..."`.
const DARK_BRANCH_BEFORE = /(?:isDark|isDarkMode|dark)\s*(?:\?\s*|&&\s*)$/;

// Explicit exceptions: files whose light greys sit on an always-dark surface.
const ALLOWLIST: Record<string, string> = {
  '/src/features/superadmin/AdminAuthModal.tsx': 'Superadmin login card is always dark (bg-slate-900), never themed light.',
  '/src/features/landing/LandingPage.tsx': 'Landing page is a fixed dark marketing surface independent of the admin theme.',
};

const sources = import.meta.glob(
  ['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}', '!/src/__guards__/**'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

const QUOTE = /["'`]/;

/** Bounds of the quoted segment (between the nearest quotes) surrounding `index`. */
function segmentAround(code: string, index: number): [number, number] {
  let start = index;
  while (start > 0 && !QUOTE.test(code[start - 1])) start--;
  let end = index;
  while (end < code.length && !QUOTE.test(code[end])) end++;
  return [start, end];
}

function findOffenders(file: string, code: string): string[] {
  if (file in ALLOWLIST) return [];
  const out: string[] = [];
  for (const re of [LIGHT_FAILING, LOW_ALPHA, LIGHT_FAILING_HUE, WHITE_ON_FILL, SLATE_500_TEXT]) {
    for (const match of code.matchAll(re)) {
      const index = match.index ?? 0;
      const [start, end] = segmentAround(code, index);
      const segment = code.slice(start, end);
      if (re === WHITE_ON_FILL && !TEXT_WHITE.test(segment)) continue;
      if (re === SLATE_500_TEXT && !SLATE_TINT_BG.test(segment)) continue;
      if (DARK_SURFACE_IN_STRING.test(segment)) continue;
      if (DARK_BRANCH_BEFORE.test(code.slice(Math.max(0, start - 40), start - 1))) continue;
      const line = code.slice(0, index).split('\n').length;
      out.push(`${file}:${line} ${match[0]}`);
    }
  }
  return out;
}

describe('text contrast tokens', () => {
  it('scans production sources', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50);
  });

  it('keeps every allowlist entry justified and pointing at a real file', () => {
    for (const [file, reason] of Object.entries(ALLOWLIST)) {
      expect(file in sources, `${file} not found`).toBe(true);
      expect(reason.length).toBeGreaterThan(10);
    }
  });

  it('flags light greys on light surfaces (self-check)', () => {
    expect(findOffenders('/x.tsx', 'const a = "text-xs text-slate-400 dark:text-slate-400"')).toHaveLength(1);
    expect(findOffenders('/x.tsx', 'const a = "text-xs text-slate-500 dark:text-slate-400"')).toHaveLength(0);
    expect(findOffenders('/x.tsx', 'const a = "bg-slate-900 text-slate-400"')).toHaveLength(0);
    expect(findOffenders('/x.tsx', 'const a = isDark ? "text-slate-400" : "text-slate-600"')).toHaveLength(0);
    expect(findOffenders('/x.tsx', 'const a = "text-slate-500/60"')).toHaveLength(1);
    expect(findOffenders('/x.tsx', 'const a = "text-emerald-600 dark:text-emerald-400"')).toHaveLength(1);
    expect(findOffenders('/x.tsx', 'const a = "text-emerald-700 dark:text-emerald-400"')).toHaveLength(0);
    expect(findOffenders('/x.tsx', 'const a = "bg-orange-500 text-white"')).toHaveLength(1);
    expect(findOffenders('/x.tsx', 'const a = "bg-orange-500 text-slate-900"')).toHaveLength(0);
    expect(findOffenders('/x.tsx', 'const a = "bg-emerald-500/10 text-emerald-600"')).toHaveLength(1);
    expect(findOffenders('/x.tsx', 'const a = "bg-slate-100 text-slate-500"')).toHaveLength(1);
    expect(findOffenders('/x.tsx', 'const a = "bg-white text-slate-500"')).toHaveLength(0);
  });

  it('has no muted grey below AA contrast on light surfaces', () => {
    const offenders = Object.entries(sources).flatMap(([file, code]) => findOffenders(file, code));
    expect(offenders, `Low-contrast text (use text-slate-500 or darker):\n${offenders.join('\n')}`).toEqual([]);
  });
});
