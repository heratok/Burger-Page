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
  // --color-bg-elevated-2 (#2A2F35) and --color-text-muted (#8B8F95) exactly
  // once; the four storefront themes override those variables on their own root
  // and `.dark` is the only theme-scoped block (index.css:1030). Admin *light*
  // mode is reachable (AdminLayout.tsx:642 toggles it) but defines no token set,
  // so a token fill is a #2A2F35 dark tile on a #F8FAFC page. Painting no fill
  // at all is the only shape that is right in every reachable theme: the tile
  // inherits the frame its caller already themed for the current mode.
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
