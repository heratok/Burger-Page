import { describe, expect, it } from 'vitest';

/**
 * User-read content must be at least 14px (text-sm). 12px (text-xs) is reserved for true metadata:
 * badges, uppercase micro-labels, timestamps, counters, column headers, captions, hints.
 * Narrow on purpose: form controls and <p> paragraphs, which are never metadata by themselves.
 */
const sources = import.meta.glob(
  ['/src/**/*.tsx', '!/src/**/*.test.tsx', '!/src/__guards__/**'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

const STANDALONE_TEXT_XS = /(^|[\s"'`])text-xs(?=[\s"'`]|$)/;
const FORM_CONTROLS = /^(input|textarea|select|Input|Textarea)$/;

/** Justified exceptions. A paragraph matching one of these is metadata, not content. */
const PARAGRAPH_ALLOWLIST: Array<{ why: string; test: (file: string, tag: string) => boolean }> = [
  { why: 'character counter (counter)', test: (f) => f.endsWith('/components/CharacterCounter.tsx') },
  { why: 'customizer preview is a scaled-down simulation of the storefront', test: (f) => f.endsWith('/CustomizerLivePreview.tsx') },
  { why: 'uppercase micro-label', test: (_f, tag) => /\buppercase\b/.test(tag) && /\btracking-wid/.test(tag) },
];

/** Opening JSX tags (name + attributes), tolerant of braces, template literals and arrows. */
function* openingTags(code: string): Generator<{ name: string; tag: string; line: number }> {
  const start = /<([A-Za-z][\w.]*)(?=[\s>/])/g;
  let m: RegExpExecArray | null;
  while ((m = start.exec(code))) {
    let i = m.index + m[0].length;
    let depth = 0;
    let quote: string | null = null;
    for (; i < code.length; i++) {
      const c = code[i];
      if (quote) {
        if (c === '\\') i++;
        else if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') quote = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    yield { name: m[1], tag: code.slice(m.index, i + 1), line: code.slice(0, m.index).split('\n').length };
  }
}

function offenders(match: (name: string, tag: string, file: string) => boolean): string[] {
  const found: string[] = [];
  for (const [file, code] of Object.entries(sources)) {
    for (const { name, tag, line } of openingTags(code)) {
      if (STANDALONE_TEXT_XS.test(tag) && match(name, tag, file)) found.push(`${file}:${line} <${name}>`);
    }
  }
  return found;
}

describe('body text size', () => {
  it('scans production components', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50);
  });

  it('keeps form controls at 14px or larger (text-sm, or text-base sm:text-sm)', () => {
    const list = offenders((name) => FORM_CONTROLS.test(name));
    expect(list, `Inputs must not use text-xs:\n${list.join('\n')}`).toEqual([]);
  });

  it('keeps paragraphs at 14px or larger unless they are allowlisted metadata', () => {
    const list = offenders(
      (name, tag, file) => name === 'p' && !PARAGRAPH_ALLOWLIST.some((rule) => rule.test(file, tag)),
    );
    expect(list, `Paragraphs must not use text-xs:\n${list.join('\n')}`).toEqual([]);
  });

  it('keeps shared input class constants (inputClass, getFieldInputClass, ...) at 14px or larger', () => {
    const named = /\b\w*(?:[iI]nput|[fF]ield)\w*(?:Class|Cls)\w*\s*(?:=|\()/g;
    const found: string[] = [];
    for (const [file, code] of Object.entries(sources)) {
      for (const m of code.matchAll(named)) {
        if (/label/i.test(m[0])) continue; // label classes are not form controls
        const rest = code.slice(m.index, m.index + 400);
        const end = rest.search(/\n\s*\n|\n\}/);
        const body = end === -1 ? rest : rest.slice(0, end);
        if (STANDALONE_TEXT_XS.test(body)) found.push(`${file}:${code.slice(0, m.index).split('\n').length}`);
      }
    }
    expect(found, `Input class constants must not use text-xs:\n${found.join('\n')}`).toEqual([]);
  });

  it('every allowlist rule documents why', () => {
    expect(PARAGRAPH_ALLOWLIST.every((r) => r.why.length > 5)).toBe(true);
  });
});
