import { describe, expect, it } from 'vitest';

/**
 * Triage rule for `title=` (a native tooltip that is NOT reliably exposed to touch,
 * keyboard or some screen readers):
 *
 * 1. Interactive host elements (<button>, <a>, <input>, <select>, <textarea>) that carry a
 *    `title` must not depend on it for their name: they need aria-label / aria-labelledby or
 *    visible text. The title is then only an optional hover hint.
 * 2. A `title` on a non-interactive host element (<span>, <div>, <p>, <td>, <img>...) hides
 *    information from touch and keyboard users: use the accessible <Tooltip> component
 *    (focusable trigger, hover + focus, Escape) or visible / sr-only text instead.
 * 3. Component props named `title` (modals, cards) are not DOM attributes and are ignored.
 */
const sources = import.meta.glob(
  ['/src/**/*.tsx', '!/src/**/*.test.tsx', '!/src/__guards__/**'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

const lineOf = (code: string, index: number) => code.slice(0, index).split('\n').length;

/** End index (exclusive) of a JSX opening tag starting at `start`, honoring `{...}` nesting. */
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

type Element = { open: string; body: string; index: number };

function findElements(code: string, name: string): Element[] {
  const out: Element[] = [];
  const re = new RegExp(`<${name}(?=[\\s>/])`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    const end = openingTagEnd(code, m.index);
    const open = code.slice(m.index, end);
    let body = '';
    if (!open.endsWith('/>')) {
      const close = code.indexOf(`</${name}>`, end);
      body = close === -1 ? '' : code.slice(end, close);
    }
    out.push({ open, body, index: m.index });
  }
  return out;
}

const visibleText = (body: string) =>
  body
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<[A-Za-z][^<>]*?\/>/g, '')
    .replace(/<\/?[A-Za-z][^<>]*>/g, '')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .trim();

const hasTitle = (open: string) => /\stitle=/.test(open);
const hasName = (open: string) => /\baria-label(?:ledby)?=/.test(open);

const INTERACTIVE = ['button', 'Button', 'a', 'input', 'select', 'textarea'];
const PASSIVE = ['span', 'div', 'p', 'td', 'th', 'li', 'img', 'svg', 'h1', 'h2', 'h3', 'h4'];

describe('no title-only names or hover-only information', () => {
  it('scans production sources', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50);
  });

  it('interactive elements with title= also have aria-label or visible text', () => {
    const offenders: string[] = [];
    for (const [file, code] of Object.entries(sources)) {
      for (const tag of INTERACTIVE) {
        for (const el of findElements(code, tag)) {
          if (!hasTitle(el.open) || hasName(el.open)) continue;
          if (/\{\.\.\.[a-zA-Z]/.test(el.open)) continue;
          if (tag !== 'input' && visibleText(el.body) !== '') continue;
          offenders.push(`${file}:${lineOf(code, el.index)} <${tag}>`);
        }
      }
    }
    expect(offenders, `title= used as the only accessible name:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('non-interactive elements do not carry information in title=', () => {
    const offenders: string[] = [];
    for (const [file, code] of Object.entries(sources)) {
      for (const tag of PASSIVE) {
        for (const el of findElements(code, tag)) {
          if (hasTitle(el.open)) offenders.push(`${file}:${lineOf(code, el.index)} <${tag}>`);
        }
      }
    }
    expect(offenders, `Hover-only information (use <Tooltip> or visible text):\n${offenders.join('\n')}`).toEqual([]);
  });
});
