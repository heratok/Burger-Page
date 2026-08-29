import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
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
});
