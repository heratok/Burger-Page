// @ts-expect-error node types are not installed for the browser tsconfig; vitest runs on Node.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('index.html', 'utf8') as string;
const css = readFileSync('src/index.css', 'utf8') as string;

describe('brand font loading', () => {
  it('requests the Google font with display=swap (optional/block hide or delay the brand font)', () => {
    const url = html.match(/fonts\.googleapis\.com\/css2\?[^"']*family=Onest[^"']*/)?.[0] ?? '';
    expect(url, 'Onest stylesheet URL').not.toBe('');
    expect(url).toContain('display=swap');
    expect(url).not.toMatch(/display=(optional|block|fallback|auto)/);
  });

  it('defines a metric-adjusted local fallback and places it right after Onest', () => {
    const face = css.match(/@font-face\s*\{[^}]*font-family:\s*['"]Onest Fallback['"][^}]*\}/)?.[0] ?? '';
    expect(face, '@font-face Onest Fallback').not.toBe('');
    for (const descriptor of ['size-adjust', 'ascent-override', 'descent-override', 'line-gap-override']) {
      expect(face, descriptor).toContain(descriptor);
    }
    expect(face).toMatch(/src:\s*local\(/);
    expect(css).toMatch(/--font-sans:\s*'Onest',\s*'Onest Fallback',/);
  });
});
