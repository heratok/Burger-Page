// @ts-expect-error node types are not installed for the browser tsconfig; vitest runs on Node.
import { readFileSync } from 'node:fs';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { LazyImage } from './LazyImage';

describe('LazyImage Component with Skeleton Loading', () => {
  afterEach(() => {
    cleanup();
  });
  it('renders skeleton shimmer placeholder initially while image is loading', () => {
    const { container } = render(
      <LazyImage
        src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800"
        alt="Delicious Burger"
        className="w-full h-full object-cover"
      />
    );

    const skeleton = container.querySelector('[data-slot="skeleton"]');
    expect(skeleton).toBeDefined();
    expect(skeleton).not.toBeNull();

    const img = screen.getByRole('img', { name: 'Delicious Burger' });
    expect(img).toBeDefined();
    expect(img.className).toContain('opacity-0');
  });

  it('fades in the image and hides skeleton on successful load', () => {
    const { container } = render(
      <LazyImage
        src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800"
        alt="Delicious Burger"
      />
    );

    const img = screen.getByRole('img', { name: 'Delicious Burger' });
    fireEvent.load(img);

    expect(img.className).toContain('opacity-100');
    const skeleton = container.querySelector('[data-slot="skeleton"]');
    expect(skeleton).toBeNull();
  });

  it('renders fallback icon and error state if image fails to load', () => {
    render(
      <LazyImage
        src="https://invalid-broken-url.com/nonexistent.jpg"
        alt="Broken Image"
      />
    );

    const img = screen.getByRole('img', { name: 'Broken Image' });
    fireEvent.error(img);

    expect(screen.getByTestId('lazy-image-fallback')).toBeDefined();
  });

  it('drops the skeleton for an image that was already loaded before onLoad was attached (cache hit)', () => {
    const complete = vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    const width = vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(800);
    try {
      const { container } = render(<LazyImage src="https://example.com/cached.jpg" alt="Cached" />);
      expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();
      expect(screen.getByRole('img', { name: 'Cached' }).className).toContain('opacity-100');
    } finally {
      complete.mockRestore();
      width.mockRestore();
    }
  });

  it('shows the skeleton again for a new src and clears it when that one loads', () => {
    const { container, rerender } = render(<LazyImage src="https://example.com/a.jpg" alt="Pic" />);
    fireEvent.load(screen.getByRole('img', { name: 'Pic' }));
    expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();

    rerender(<LazyImage src="https://example.com/b.jpg" alt="Pic" />);
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    fireEvent.load(screen.getByRole('img', { name: 'Pic' }));
    expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();
  });
});

describe('LazyImage fallback theming (S13)', () => {
  afterEach(() => {
    cleanup();
  });

  const tokens = () =>
    screen.getByTestId('lazy-image-fallback').className.split(/\s+/).filter(Boolean);

  // S13 — the fallback must never paint its own opaque fill. index.css defines
  // --color-bg-elevated-2 (#2A2F35) once and --color-text-muted for the dark
  // surfaces, with `.admin-light` as the one theme-scoped light override (see
  // the S13 token test below); the four storefront themes override those
  // variables on their own root. A token fill would therefore be a #2A2F35 dark
  // tile on the #F8FAFC admin light page. Painting no fill at all is the only
  // shape that is right in every reachable theme: the tile inherits the frame
  // its caller already themed for the current mode.
  it('leaves the surface to the caller frame instead of painting an opaque tile', () => {
    render(<LazyImage src="" alt="Missing" />);

    // No background utility of any kind: not the token, not a slate pair, not white.
    expect(tokens().filter((t) => /^bg-/.test(t))).toEqual([]);
    expect(tokens()).not.toContain('bg-bg-elevated-2');
  });

  it('paints the glyph with the theme muted token, so it inverts with the theme', () => {
    render(<LazyImage src="" alt="Missing" />);

    // The token is overridden by every storefront theme (customizerStyles.ts)
    // and is the light-on-dark value in admin dark mode.
    expect(tokens()).toContain('text-text-muted');
    expect(tokens().filter((t) => /^(text|bg)-slate-/.test(t) || t.startsWith('dark:'))).toEqual([]);
  });

  it('lets a caller frame keep its own themed background', () => {
    // ProductTable/ProductGrid pass the mode-correct frame (slate-100 / dark:slate-800);
    // cn() must not strip it or the tile would be the unthemed default.
    render(
      <LazyImage
        src=""
        alt="Missing"
        containerClassName="size-10 rounded-lg bg-slate-100 dark:bg-slate-800"
      />
    );

    expect(tokens()).toContain('bg-slate-100');
    expect(tokens()).toContain('dark:bg-slate-800');
  });

  it('keeps the themed fallback for an image that fails to load', () => {
    render(<LazyImage src="https://invalid-broken-url.com/nonexistent.jpg" alt="Broken" />);
    fireEvent.error(screen.getByRole('img', { name: 'Broken' }));

    expect(tokens().filter((t) => /^bg-/.test(t))).toEqual([]);
    expect(tokens()).toContain('text-text-muted');
  });
});

/**
 * S13 residual — the glyph paints `text-text-muted`, and index.css resolves that
 * utility through `var(--color-text-muted)` (the @layer utilities shim), so the
 * token decides the contrast. It used to be defined once (#8B8F95, made for the
 * dark surfaces): on the slate-100 image frame of admin *light* mode that reads
 * 2.97:1, below the 3:1 every WCAG 1.4.11 graphic needs. This pins the scoped
 * light-admin override so it cannot be dropped or widened silently.
 */

// Vitest stubs CSS imports, so the source is read the way the __guards__ tests do.
const indexCss: string = readFileSync('src/index.css', 'utf8');

interface TokenDefinition {
  selector: string;
  value: string;
}

/** Every `--color-text-muted` definition in index.css, with its selector. */
function mutedTokenDefinitions(): TokenDefinition[] {
  const definitions: TokenDefinition[] = [];
  for (const block of indexCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const prelude = block[1];
    const selector = prelude
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .pop();
    if (!selector) continue;
    for (const declaration of block[2].split(';')) {
      const colon = declaration.indexOf(':');
      if (colon === -1) continue;
      const property = declaration.slice(0, colon).trim();
      if (property !== '--color-text-muted') continue;
      definitions.push({ selector, value: declaration.slice(colon + 1).trim().toLowerCase() });
    }
  }
  return definitions;
}

/** WCAG 2 relative luminance of a #RRGGBB colour. */
function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(foreground: string, background: string): number {
  const [high, low] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (high + 0.05) / (low + 0.05);
}

const SLATE_100 = '#f1f5f9'; // the admin light image frame (ProductGrid/ProductTable)
const ADMIN_LIGHT_PAGE = '#f8fafc'; // AdminLayout's admin-light background

describe('LazyImage fallback in admin light (S13 residual)', () => {
  it('reads the scoped light-admin token out of index.css (self-check)', () => {
    expect(indexCss.length).toBeGreaterThan(1000);
    expect(mutedTokenDefinitions().length).toBeGreaterThanOrEqual(2);
  });

  it('keeps the base token untouched and scopes the legible value to .admin-light only', () => {
    const definitions = mutedTokenDefinitions();
    const bySelector = (selector: string) => definitions.filter((d) => d.selector === selector);

    // The base value is what the dark surfaces and the storefront expect.
    expect(bySelector('@theme inline')).toEqual([{ selector: '@theme inline', value: '#8b8f95' }]);
    // Admin light is the only theme that redefines it, and only to this value.
    expect(bySelector('.admin-light')).toEqual([{ selector: '.admin-light', value: '#64748b' }]);
    // No other block in index.css moves the token: `.dark` keeps the base value.
    expect(definitions.map((d) => d.selector).sort()).toEqual(['.admin-light', '@theme inline']);
  });

  it('makes the muted glyph legible on the light admin surfaces', () => {
    const adminLight = mutedTokenDefinitions().find((d) => d.selector === '.admin-light');
    expect(adminLight).toBeDefined();
    const muted = adminLight!.value;

    // Old single token: 2.97:1 on slate-100 (below the 3:1 floor).
    expect(contrast('#8b8f95', SLATE_100)).toBeLessThan(3);

    // The scoped value clears the floor on the frame and reads as text on the page.
    expect(contrast(muted, SLATE_100)).toBeGreaterThanOrEqual(3);
    expect(contrast(muted, ADMIN_LIGHT_PAGE)).toBeGreaterThanOrEqual(4.5);
  });

  it('does not repaint anything else in the light admin theme', () => {
    const lightBlock = /\.admin-light\s*\{([^{}]*)\}/.exec(indexCss);
    expect(lightBlock).not.toBeNull();
    const properties = lightBlock![1]
      .split(';')
      .map((declaration) => declaration.split(':')[0].trim())
      .filter(Boolean);

    expect(properties).toEqual(['--color-text-muted']);
  });
});
