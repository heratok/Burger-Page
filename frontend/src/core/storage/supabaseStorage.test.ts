import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dataUrlToBlob, uploadImageToStorage } from './supabaseStorage';

describe('supabaseStorage - Direct-to-Storage upload & fallback', () => {
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
});
