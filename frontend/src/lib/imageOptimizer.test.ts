import { describe, it, expect, vi, beforeEach } from 'vitest';
import { optimizeImageToWebP } from './imageOptimizer';

describe('imageOptimizer - Client-side WebP conversion and resizing', () => {
  beforeEach(() => {
    // Mock URL.createObjectURL and URL.revokeObjectURL
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/mock-blob-url');
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it('rejects files with invalid mime types', async () => {
    const textFile = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    await expect(optimizeImageToWebP(textFile)).rejects.toThrow(/no es una imagen válida/);
  });

  it('handles image loading, canvas drawing, and returns webp data url', async () => {
    const mockImageFile = new File(['fake-image-bytes'], 'burger.jpg', { type: 'image/jpeg' });

    // Mock Image implementation
    const originalImage = globalThis.Image;
    class MockImage {
      onload: (() => void) | null = null;
      onerror: ((err: any) => void) | null = null;
      width = 2400;
      height = 1800;
      private _src = '';

      set src(value: string) {
        this._src = value;
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 10);
      }
      get src() {
        return this._src;
      }
    }
    globalThis.Image = MockImage as any;

    // Mock HTMLCanvasElement
    const mockContext = {
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
      drawImage: vi.fn(),
    };

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: vi.fn(() => mockContext),
          toDataURL: vi.fn((type: string, quality?: number) => {
            return `data:${type};base64,mockWebpContent-quality-${quality}`;
          }),
        } as any;
      }
      return originalCreateElement(tagName);
    });

    const result = await optimizeImageToWebP(mockImageFile, { maxWidth: 800, maxHeight: 600, quality: 0.8 });

    expect(result).toContain('data:image/webp;base64,mockWebpContent-quality-0.8');
    expect(mockContext.drawImage).toHaveBeenCalled();

    // Restore Image
    globalThis.Image = originalImage;
  });
});
