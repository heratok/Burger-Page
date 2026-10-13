import { describe, expect, it } from 'vitest';

/**
 * WCAG 2.1.2 / 2.4.3 / 4.1.2: a hand-rolled `fixed inset-0 z-*` overlay that renders a dialog has no
 * focus trap, ignores Escape, never restores focus and may lack role/aria-modal/name.
 *
 * Rule: every such overlay is rendered through the shared `<ModalShell>` (src/components/ui/modal-shell.tsx)
 * or the base-ui Dialog wrapper (src/components/ui/dialog.tsx), and every ModalShell carries an accessible
 * name (aria-labelledby or aria-label).
 *
 * Ignored by design: decorative layers (`pointer-events-none`) and the allowlist below.
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

function openingTags(code: string, name: string): { open: string; index: number }[] {
  const out: { open: string; index: number }[] = [];
  const re = new RegExp(`<${name}(?=[\\s>/])`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) out.push({ open: code.slice(m.index, openingTagEnd(code, m.index)), index: m.index });
  return out;
}

/**
 * Overlays intentionally not using the shell. Each entry must say why.
 * - AdminLayout: the mobile-drawer backdrop is a decorative scrim; the drawer itself is handled in
 *   AdminLayout (inert when closed, Escape, focus return) and covered by e2e/a11y-modals.spec.ts.
 * - AdditionsModal: photo lightbox portalled out of a base-ui Dialog; it owns a capture-phase Escape
 *   (so the parent Dialog does not close too) and focus hand-off to its close button / trigger.
 */
const ALLOWLIST = [
  '/src/features/crm/AdminLayout.tsx',
  '/src/features/cart/AdditionsModal.tsx',
];

const isOverlay = (open: string) =>
  /\bfixed\s+inset-0\b/.test(open) && /\bz-[\w[\]]+/.test(open) && !/pointer-events-none/.test(open);

describe('modal semantics', () => {
  it('scans production sources', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50);
  });

  it('dialog overlays use ModalShell instead of a bare fixed inset-0 element', () => {
    const offenders: string[] = [];
    for (const [file, code] of Object.entries(sources)) {
      if (ALLOWLIST.includes(file)) continue;
      for (const tag of ['div', 'section', 'button']) {
        for (const el of openingTags(code, tag)) {
          if (isOverlay(el.open)) offenders.push(`${file}:${lineOf(code, el.index)} <${tag}>`);
        }
      }
    }
    expect(offenders, `Use <ModalShell> (or base-ui Dialog) for dialog overlays:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('every ModalShell has an accessible name', () => {
    const offenders: string[] = [];
    let count = 0;
    for (const [file, code] of Object.entries(sources)) {
      if (file.endsWith('/modal-shell.tsx')) continue;
      for (const el of openingTags(code, 'ModalShell')) {
        count++;
        if (!/\baria-label(?:ledby)?=/.test(el.open)) offenders.push(`${file}:${lineOf(code, el.index)}`);
      }
    }
    expect(count).toBeGreaterThan(10);
    expect(offenders, `ModalShell without aria-labelledby/aria-label:\n${offenders.join('\n')}`).toEqual([]);
  });
});
