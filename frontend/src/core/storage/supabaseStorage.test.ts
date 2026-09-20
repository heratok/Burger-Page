import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  dataUrlToBlob,
  uploadImageToStorage,
  resolveImageUrl,
  getDefaultStorageBucket,
  sanitizeSegment,
} from './supabaseStorage';
import { apiClient } from '../api/apiClient';

describe('supabaseStorage - Storage decoupling and resolveImageUrl', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('converts a base64 Data URL to a Blob properly', () => {
    const mockDataUrl = 'data:image/webp;base64,dGVzdC1pbWFnZS1kYXRh';
    const blob = dataUrlToBlob(mockDataUrl);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/webp');
  });

  it('returns data URL as fallback when no Supabase credentials are configured', async () => {
    const mockDataUrl = 'data:image/webp;base64,dGVzdA==';
    const url = await uploadImageToStorage(mockDataUrl, {
      restaurantId: 'burger-craft',
      folder: 'products',
      supabaseUrl: '',
      supabaseKey: '',
    });
    expect(url).toBe(mockDataUrl);
  });

  it('returns external HTTP URLs directly without re-uploading', async () => {
    const externalUrl = 'https://images.unsplash.com/photo-12345';
    const result = await uploadImageToStorage(externalUrl, {
      restaurantId: 'burger-craft',
    });
    expect(result).toBe(externalUrl);
  });

  describe('sanitizeSegment', () => {
    it('normalizes backslashes to slashes and joins surviving parts with dashes', () => {
      expect(sanitizeSegment('a\\b')).toBe('a-b');
      expect(sanitizeSegment('a/b')).toBe('a-b');
    });

    it('strips empty, dot, and dot-dot traversal parts', () => {
      expect(sanitizeSegment('../../other-tenant/branding/logo')).toBe('other-tenant-branding-logo');
      expect(sanitizeSegment('a//b/./c')).toBe('a-b-c');
      expect(sanitizeSegment('..')).toBe('');
    });
  });

  describe('uploadImageToStorage legacy direct-upload fallback', () => {
    const imageDataUrl = 'data:image/webp;base64,dGVzdA==';

    beforeEach(() => {
      // Force the legacy branch: presigned endpoint unreachable
      vi.spyOn(apiClient, 'getPresignedUploadUrl').mockRejectedValue(new Error('offline'));
      vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('never uses the client-supplied filename and strips traversal segments from the upload URL', async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValue({ ok: true } as Response);

      const result = await uploadImageToStorage(imageDataUrl, {
        restaurantId: 'victim-tenant',
        folder: 'branding',
        filename: '../../other-tenant/branding/logo',
        supabaseUrl: 'https://test-project.supabase.co/',
        supabaseKey: 'test-anon-key',
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [uploadUrl, init] = fetchMock.mock.calls[0];
      const url = String(uploadUrl);

      // No traversal segments and none of the client-supplied path survives
      expect(url).not.toContain('..');
      expect(url).not.toContain('other-tenant');
      expect(url).not.toContain('logo');
      expect(url).toMatch(/\/storage\/v1\/object\/image\/victim-tenant\/branding\/[a-f0-9-]{8,}\.webp$/);

      // The object id is a fresh random value, not the passed filename
      expect(result).toMatch(/^victim-tenant\/branding\/[a-f0-9-]{8,}\.webp$/);
      expect(result).not.toContain('logo');
      expect(init?.method).toBe('POST');
    });

    it('does not send an x-upsert header on the legacy direct upload', async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValue({ ok: true } as Response);

      await uploadImageToStorage(imageDataUrl, {
        restaurantId: 'victim-tenant',
        folder: 'branding',
        filename: 'trusted-name',
        supabaseUrl: 'https://test-project.supabase.co/',
        supabaseKey: 'test-anon-key',
      });

      const [, init] = fetchMock.mock.calls[0];
      expect(init?.headers).not.toHaveProperty('x-upsert');
      expect(init?.headers).not.toHaveProperty('X-Upsert');
    });
  });

  describe('resolveImageUrl', () => {
    beforeEach(() => {
      vi.stubEnv('PUBLIC_SUPABASE_URL', 'https://test-project.supabase.co');
    });

    it('handles null, undefined, and empty strings gracefully', () => {
      expect(resolveImageUrl(null)).toBe('');
      expect(resolveImageUrl(undefined)).toBe('');
      expect(resolveImageUrl('')).toBe('');
      expect(resolveImageUrl('   ')).toBe('');
    });

    it('leaves data URLs and blob URLs untouched', () => {
      const dataUrl = 'data:image/webp;base64,sampledata';
      expect(resolveImageUrl(dataUrl)).toBe(dataUrl);

      const blobUrl = 'blob:http://localhost:5173/uuid-123';
      expect(resolveImageUrl(blobUrl)).toBe(blobUrl);
    });

    it('leaves external HTTP/HTTPS images (Unsplash, external CDNs) untouched', () => {
      const unsplashUrl = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd';
      expect(resolveImageUrl(unsplashUrl)).toBe(unsplashUrl);

      const cdnUrl = 'http://my-cdn.com/burgers/classic.png';
      expect(resolveImageUrl(cdnUrl)).toBe(cdnUrl);
    });

    it('resolves relative storage paths to active bucket and domain', () => {
      const relativePath = 'burger-craft/products/special.webp';
      const resolved = resolveImageUrl(relativePath, 'custom-bucket');
      expect(resolved).toContain('/storage/v1/object/public/custom-bucket/burger-craft/products/special.webp');
    });

    it('resolves storage:// protocol URIs to active bucket and domain', () => {
      const storageUri = 'storage://burger-craft/branding/logo.webp';
      const resolved = resolveImageUrl(storageUri, 'branding-bucket');
      expect(resolved).toContain('/storage/v1/object/public/branding-bucket/burger-craft/branding/logo.webp');
    });

    it('dynamically remaps existing Supabase URLs when bucket is changed', () => {
      const oldUrl = 'https://test-project.supabase.co/storage/v1/object/public/old-bucket/tenant-1/products/123.webp';
      const remapped = resolveImageUrl(oldUrl, 'new-bucket');
      expect(remapped).toContain('/storage/v1/object/public/new-bucket/tenant-1/products/123.webp');
      expect(remapped).not.toContain('/old-bucket/');
    });
  });

  describe('getDefaultStorageBucket', () => {
    it('returns a fallback bucket name of "image" when not specified in env', () => {
      const bucket = getDefaultStorageBucket();
      expect(typeof bucket).toBe('string');
      expect(bucket.length).toBeGreaterThan(0);
    });
  });
});
