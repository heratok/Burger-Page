export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

/**
 * Optimizes an image File/Blob on the client-side:
 * 1. Proportionally resizes to max dimensions (preventing oversized 4K/8K images).
 * 2. Compresses and converts to modern WebP format using HTML5 Canvas.
 * 3. Returns a compact Data URL ready for storage and instantaneous rendering.
 */
export async function optimizeImageToWebP(
  file: File | Blob,
  options: ImageOptimizationOptions = {}
): Promise<string> {
  const { maxWidth = 1200, maxHeight = 1200, quality = 0.82 } = options;

  return new Promise((resolve, reject) => {
    // If not a valid image type, reject early
    if (file.type && !file.type.startsWith('image/')) {
      return reject(new Error('El archivo seleccionado no es una imagen válida'));
    }

    if (typeof document === 'undefined' || typeof window === 'undefined') {
      // Server-side fallback: convert to base64
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width === 0 || height === 0) {
        width = 400;
        height = 300;
      }

      // Proportional resizing
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Canvas 2D context not available');
        }

        // High quality smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const webpData = canvas.toDataURL('image/webp', quality);
        resolve(webpData);
      } catch {
        // Fallback to direct FileReader if canvas conversion fails
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo procesar la imagen seleccionada'));
    };

    img.src = objectUrl;
  });
}
