import { describe, expect, it } from 'vitest';

// Production sources only: tests and guards are excluded.
const sources = import.meta.glob(
  ['/src/**/*.tsx', '!/src/**/*.test.tsx', '!/src/__guards__/**'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

const lineOf = (code: string, index: number) => code.slice(0, index).split('\n').length;

/** Returns the end index (exclusive) of a JSX opening tag starting at `start`, honoring `{...}` nesting. */
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

type Element = { tag: string; open: string; body: string; index: number; selfClosing: boolean };

function findElements(code: string, name: string): Element[] {
  const out: Element[] = [];
  const re = new RegExp(`<${name}(?=[\\s>/])`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    const end = openingTagEnd(code, m.index);
    const open = code.slice(m.index, end);
    const selfClosing = open.endsWith('/>');
    let body = '';
    if (!selfClosing) {
      const close = code.indexOf(`</${name}>`, end);
      body = close === -1 ? '' : code.slice(end, close);
    }
    out.push({ tag: name, open, body, index: m.index, selfClosing });
  }
  return out;
}

const CONTROL = /<(?:input|select|textarea|Input|Textarea|Switch|ModernSelect|Checkbox|Select|RadioGroupItem)\b/;

describe('a11y forms guard', () => {
  it('scans production sources', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50);
  });

  it('every <label> has htmlFor or wraps its control', () => {
    const offenders: string[] = [];
    for (const [file, code] of Object.entries(sources)) {
      for (const tag of ['label', 'Label']) {
        for (const el of findElements(code, tag)) {
          if (/\bhtmlFor=/.test(el.open) || /\{\.\.\.props\}/.test(el.open) || CONTROL.test(el.body)) continue;
          offenders.push(`${file}:${lineOf(code, el.index)}`);
        }
      }
    }
    expect(offenders, `Unassociated labels (add htmlFor+id or wrap the control):\n${offenders.join('\n')}`).toEqual([]);
  });

  it('no icon-only <button> lacks an accessible name', () => {
    const offenders: string[] = [];
    for (const [file, code] of Object.entries(sources)) {
      for (const el of findElements(code, 'button')) {
        if (/\baria-label(?:ledby)?=/.test(el.open) || /\{\.\.\.[a-zA-Z]/.test(el.open)) continue;
        // Strip self-closing elements (icons) and any remaining tags; what is left is text/expressions.
        const text = el.body
          .replace(/<svg[\s\S]*?<\/svg>/g, '')
          .replace(/<[A-Za-z][^<>]*?\/>/g, '')
          .replace(/<\/?[A-Za-z][^<>]*>/g, '')
          .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
          .trim();
        if (text === '' && /<(?:svg|[A-Z][A-Za-z0-9]*)\b/.test(el.body)) {
          offenders.push(`${file}:${lineOf(code, el.index)}`);
        }
      }
    }
    expect(offenders, `Icon-only buttons without aria-label:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('every <img> declares alt', () => {
    const offenders: string[] = [];
    for (const [file, code] of Object.entries(sources)) {
      for (const el of findElements(code, 'img')) {
        if (!/\balt=/.test(el.open) && !/\{\.\.\./.test(el.open)) offenders.push(`${file}:${lineOf(code, el.index)}`);
      }
    }
    expect(offenders, `Images without alt:\n${offenders.join('\n')}`).toEqual([]);
  });

  describe('skip links', () => {
    const shells = [
      '/src/features/crm/AdminLayout.tsx',
      '/src/features/storefront/Navbar.tsx',
      '/src/features/landing/LandingPage.tsx',
    ];

    for (const shell of shells) {
      it(`${shell} renders a skip link`, () => {
        const code = sources[shell];
        expect(code, `${shell} not found`).toBeTruthy();
        expect(code).toMatch(/Saltar al contenido/);
        expect(code).toMatch(/href="#main-content"/);
      });
    }

    it('the skip target id exists on a <main> in each shell tree', () => {
      for (const file of ['/src/features/crm/AdminLayout.tsx', '/src/features/storefront/Home.tsx', '/src/features/landing/LandingPage.tsx']) {
        const mains = findElements(sources[file], 'main');
        expect(mains.length, `${file}: exactly one <main>`).toBe(1);
        expect(mains[0].open, `${file}: <main id="main-content">`).toMatch(/id="main-content"/);
        expect(mains[0].open, `${file}: <main tabIndex={-1}>`).toMatch(/tabIndex=\{-1\}/);
      }
    });

    it('the AdminLayout skip link precedes the sidebar', () => {
      const code = sources['/src/features/crm/AdminLayout.tsx'];
      const skip = code.indexOf('Saltar al contenido');
      const aside = code.indexOf('<aside');
      expect(skip).toBeGreaterThan(-1);
      expect(skip).toBeLessThan(aside);
    });
  });
});
