import { apiClient } from '../api/apiClient';

/**
 * Converts a base64/WebP Data URL to a native Blob for storage upload.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(';base64,');
  const contentType = parts[0].replace('data:', '') || 'image/webp';
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);

  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }

  return new Blob([uInt8Array], { type: contentType });
}

export interface UploadImageOptions {
  restaurantId: string;
  folder?: 'products' | 'branding' | 'general';
  filename?: string;
  bucketName?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
}

/**
 * Returns the default Supabase Storage bucket name from environment variables.
 * Defaults to 'image' for backwards compatibility.
 */
export function getDefaultStorageBucket(): string {
  return (
    import.meta.env.VITE_SUPABASE_STORAGE_BUCKET ||
    import.meta.env.PUBLIC_SUPABASE_STORAGE_BUCKET ||
    'image'
  );
}

/**
 * Returns the Supabase project base URL from environment variables.
 */
export function getSupabaseBaseUrl(): string {
  return (
    import.meta.env.PUBLIC_SUPABASE_URL ||
    import.meta.env.VITE_SUPABASE_URL ||
    ''
  ).replace(/\/$/, '');
}

/**
 * Dynamically resolves an image source to an active, valid URL:
 * - Returns empty string if src is null/undefined/empty.
 * - Leaves external URLs (Unsplash, external CDNs, blob:, data:) intact.
 * - Resolves relative storage paths (e.g. "tenant-1/products/abc.webp" or "storage://...")
 *   against the currently configured Supabase project and active bucket.
 * - Automatically remaps legacy/existing Supabase storage URLs to the active bucket and domain
 *   if the bucket name was changed in the environment variables.
 */
export function resolveImageUrl(src: string | null | undefined, customBucket?: string): string {
  if (!src || typeof src !== 'string') return '';
  const trimmed = src.trim();
  if (!trimmed) return '';

  // 1. Data URLs or blob URLs
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  const supabaseUrl = getSupabaseBaseUrl();
  const bucket = customBucket || getDefaultStorageBucket();

  // 2. Storage URI scheme (storage://<path>)
  if (trimmed.startsWith('storage://')) {
    const objectPath = trimmed.replace(/^storage:\/\//, '').replace(/^\/+/, '');
    if (!supabaseUrl) return trimmed;
    return `${supabaseUrl}/storage/v1/object/public/${bucket}/${objectPath}`;
  }

  // 3. Existing Supabase Storage Public URL (/storage/v1/object/public/<oldBucket>/<objectPath>)
  const supabaseStorageRegex = /https?:\/\/[^/]+\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/;
  const match = trimmed.match(supabaseStorageRegex);
  if (match) {
    const originalBucket = match[1];
    const objectPath = match[2];
    // If the active bucket or base host changed in the environment, dynamically remap to the active bucket
    if (supabaseUrl && (bucket !== originalBucket || !trimmed.startsWith(supabaseUrl))) {
      return `${supabaseUrl}/storage/v1/object/public/${bucket}/${objectPath}`;
    }
    return trimmed;
  }

  // 4. Other absolute HTTP/HTTPS URLs (e.g. Unsplash, external CDNs)
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // 5. Relative storage object path (e.g. "burger-craft/products/123.webp")
  if (supabaseUrl) {
    const cleanPath = trimmed.replace(/^\/+/, '');
    return `${supabaseUrl}/storage/v1/object/public/${bucket}/${cleanPath}`;
  }

  return trimmed;
}

/**
 * Uploads an optimized WebP image directly to Supabase Storage:
 * 1. Requests a short-lived Presigned Upload URL from the backend (Gold Standard - zero credentials on client).
 * 2. Uploads the WebP binary directly to the storage bucket via PUT.
 * 3. Gracefully falls back to direct REST or local Data URL if offline.
 */
export async function uploadImageToStorage(
  imageSource: string | File | Blob,
  options: UploadImageOptions
): Promise<string> {
  if (typeof imageSource === 'string' && (imageSource.startsWith('http://') || imageSource.startsWith('https://'))) {
    return imageSource;
  }

  const folder = options.folder || 'general';
  const cleanRestId = options.restaurantId.replace(/[^a-z0-9-_]/gi, '-');
  const uniqueId = options.filename || `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const objectPath = `${cleanRestId}/${folder}/${uniqueId}.webp`;

  let blob: Blob;
  if (typeof imageSource === 'string' && imageSource.startsWith('data:')) {
    blob = dataUrlToBlob(imageSource);
  } else if (imageSource instanceof Blob) {
    blob = imageSource;
  } else {
    return typeof imageSource === 'string' ? imageSource : '';
  }

  // 1. Presigned Upload URL Pattern (Industry Gold Standard)
  try {
    const presigned = await apiClient.getPresignedUploadUrl({
      restaurantId: options.restaurantId,
      folder: folder as any,
      filename: options.filename,
    });

    if (presigned?.mode === 'signed_url' && presigned.uploadUrl) {
      const response = await fetch(presigned.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'image/webp',
          'x-upsert': 'true',
        },
        body: blob,
      });

      if (response.ok) {
        return presigned.publicUrl || presigned.path;
      }
      console.warn(`Presigned upload failed (${response.status}), attempting fallback...`);
    }
  } catch {
    // Presigned endpoint unreachable (offline/mock environment) -> continue to legacy fallback
  }

  // 2. Legacy Direct Upload if explicit credentials provided
  const supabaseUrl =
    options.supabaseUrl !== undefined
      ? options.supabaseUrl
      : getSupabaseBaseUrl();
  const supabaseKey =
    options.supabaseKey !== undefined
      ? options.supabaseKey
      : import.meta.env.PUBLIC_SUPABASE_ANON_KEY ||
        import.meta.env.PUBLIC_SUPABASE_KEY ||
        import.meta.env.VITE_SUPABASE_ANON_KEY ||
        import.meta.env.VITE_SUPABASE_KEY ||
        '';

  const bucket = options.bucketName || getDefaultStorageBucket();

  if (supabaseUrl && supabaseKey) {
    try {
      const uploadEndpoint = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${bucket}/${objectPath}`;
      const response = await fetch(uploadEndpoint, {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'image/webp',
          'x-upsert': 'true',
        },
        body: blob,
      });

      if (response.ok) {
        return objectPath;
      }
    } catch {
      // Fallback
    }
  }

  return typeof imageSource === 'string' ? imageSource : '';
}
