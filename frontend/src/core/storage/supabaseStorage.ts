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
 * Uploads an optimized WebP image directly to Supabase Storage:
 * - If Supabase credentials (PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY) are configured,
 *   uploads to the bucket (default 'image') and returns the permanent CDN public URL.
 * - If credentials are not present, gracefully returns the Data URL for local/offline usage.
 */
export async function uploadImageToStorage(
  imageSource: string | File | Blob,
  options: UploadImageOptions
): Promise<string> {
  const supabaseUrl =
    options.supabaseUrl !== undefined
      ? options.supabaseUrl
      : import.meta.env.PUBLIC_SUPABASE_URL ||
        import.meta.env.VITE_SUPABASE_URL ||
        '';
  const supabaseKey =
    options.supabaseKey !== undefined
      ? options.supabaseKey
      : import.meta.env.PUBLIC_SUPABASE_ANON_KEY ||
        import.meta.env.PUBLIC_SUPABASE_KEY ||
        import.meta.env.VITE_SUPABASE_ANON_KEY ||
        import.meta.env.VITE_SUPABASE_KEY ||
        '';

  // If no Supabase config is set or imageSource is already a full http URL, return as is
  if (!supabaseUrl || !supabaseKey) {
    if (typeof imageSource === 'string') return imageSource;
  }

  if (typeof imageSource === 'string' && (imageSource.startsWith('http://') || imageSource.startsWith('https://'))) {
    return imageSource;
  }

  const bucket = options.bucketName || 'image';
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
    // Return original string if not convertible
    return typeof imageSource === 'string' ? imageSource : '';
  }

  // If credentials exist, perform Direct-to-Storage upload via Supabase REST API
  if (supabaseUrl && supabaseKey) {
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

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`Supabase Storage upload warning (${response.status}):`, errorText);
      // If upload failed, fallback to local Data URL representation so user never loses their image
      return typeof imageSource === 'string' ? imageSource : '';
    }

    // Return the clean, public CDN URL
    const publicUrl = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${objectPath}`;
    return publicUrl;
  }

  return typeof imageSource === 'string' ? imageSource : '';
}
