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
