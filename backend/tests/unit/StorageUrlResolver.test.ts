import { describe, it, expect } from 'vitest';
import { StorageUrlResolver } from '../../src/infrastructure/storage/StorageUrlResolver.js';

describe('StorageUrlResolver (Backend Architecture)', () => {
  const mockBaseUrl = 'https://my-project.supabase.co';
  const defaultBucket = 'image';
  const resolver = new StorageUrlResolver(mockBaseUrl, defaultBucket);

  describe('resolveImageUrl', () => {
    it('returns undefined for empty/null/undefined inputs', () => {
      expect(resolver.resolveImageUrl(null)).toBeUndefined();
      expect(resolver.resolveImageUrl(undefined)).toBeUndefined();
      expect(resolver.resolveImageUrl('')).toBeUndefined();
      expect(resolver.resolveImageUrl('   ')).toBeUndefined();
    });

    it('returns data URLs and blob URLs as is', () => {
      const dataUrl = 'data:image/webp;base64,12345';
      expect(resolver.resolveImageUrl(dataUrl)).toBe(dataUrl);
    });

    it('returns external HTTP URLs (Unsplash) as is', () => {
      const externalUrl = 'https://images.unsplash.com/photo-burger-123';
      expect(resolver.resolveImageUrl(externalUrl)).toBe(externalUrl);
    });

    it('resolves relative storage paths to active bucket', () => {
      const relativePath = 'burger-craft/products/artesanal.webp';
      const resolved = resolver.resolveImageUrl(relativePath);
      expect(resolved).toBe('https://my-project.supabase.co/storage/v1/object/public/image/burger-craft/products/artesanal.webp');
    });

    it('resolves storage:// protocol URIs to active bucket', () => {
      const storageUri = 'storage://burger-craft/products/artesanal.webp';
      const resolved = resolver.resolveImageUrl(storageUri);
      expect(resolved).toBe('https://my-project.supabase.co/storage/v1/object/public/image/burger-craft/products/artesanal.webp');
    });

    it('dynamically remaps legacy URLs when a new bucket is configured', () => {
      const newBucketResolver = new StorageUrlResolver(mockBaseUrl, 'menu-assets-2026');
      const legacyUrl = 'https://old-host.supabase.co/storage/v1/object/public/image/burger-craft/products/artesanal.webp';
      const resolved = newBucketResolver.resolveImageUrl(legacyUrl);
      expect(resolved).toBe('https://my-project.supabase.co/storage/v1/object/public/menu-assets-2026/burger-craft/products/artesanal.webp');
    });
  });

  describe('toRelativeStoragePath', () => {
    it('extracts relative object path from Supabase storage URL for clean DB persistence', () => {
      const supabaseUrl = 'https://my-project.supabase.co/storage/v1/object/public/image/burger-craft/products/artesanal.webp';
      const relative = resolver.toRelativeStoragePath(supabaseUrl);
      expect(relative).toBe('burger-craft/products/artesanal.webp');
    });

    it('preserves external URLs as is', () => {
      const external = 'https://images.unsplash.com/photo-burger';
      expect(resolver.toRelativeStoragePath(external)).toBe(external);
    });

    it('preserves already relative paths as is', () => {
      const rel = 'burger-craft/products/artesanal.webp';
      expect(resolver.toRelativeStoragePath(rel)).toBe(rel);
    });
  });
});
