/**
 * StorageUrlResolver
 * Responsible for canonical storage path resolution and URL normalization:
 * - Decouples database storage from hardcoded bucket names and CDN hostnames.
 * - Resolves relative paths, storage:// URIs, and legacy Supabase bucket URLs to the active bucket and domain.
 * - Converts absolute Supabase upload URLs to clean relative paths before database persistence.
 */
export class StorageUrlResolver {
  private explicitBaseUrl?: string;
  private explicitDefaultBucket?: string;

  constructor(baseUrl?: string, defaultBucket?: string) {
    this.explicitBaseUrl = baseUrl;
    this.explicitDefaultBucket = defaultBucket;
  }

  public get baseUrl(): string {
    return (
      this.explicitBaseUrl !== undefined
        ? this.explicitBaseUrl
        : process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL || ''
    ).replace(/\/$/, '');
  }

  public get defaultBucket(): string {
    return (
      this.explicitDefaultBucket !== undefined
        ? this.explicitDefaultBucket
        : process.env.SUPABASE_STORAGE_BUCKET || process.env.STORAGE_BUCKET || 'image'
    );
  }

  /**
   * Resolves a raw image URL or relative path into an absolute public CDN URL.
   */
  public resolveImageUrl(rawUrlOrPath?: string | null, customBucket?: string): string | undefined {
    if (!rawUrlOrPath || typeof rawUrlOrPath !== 'string') return undefined;
    const trimmed = rawUrlOrPath.trim();
    if (!trimmed) return undefined;

    // 1. Data URLs or blob URLs
    if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
      return trimmed;
    }

    const bucket = customBucket || this.defaultBucket;

    // 2. Storage URI scheme (storage://<path>)
    if (trimmed.startsWith('storage://')) {
      const objectPath = trimmed.replace(/^storage:\/\//, '').replace(/^\/+/, '');
      if (!this.baseUrl) return trimmed;
      return `${this.baseUrl}/storage/v1/object/public/${bucket}/${objectPath}`;
    }

    // 3. Supabase Storage Public URL pattern (/storage/v1/object/public/<anyBucket>/<objectPath>)
    const supabaseStorageRegex = /https?:\/\/[^/]+\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/;
    const match = trimmed.match(supabaseStorageRegex);
    if (match) {
      const originalBucket = match[1];
      const objectPath = match[2];
      // If the active bucket or base domain differs, dynamically remap to the active configuration
      if (this.baseUrl && (bucket !== originalBucket || !trimmed.startsWith(this.baseUrl))) {
        return `${this.baseUrl}/storage/v1/object/public/${bucket}/${objectPath}`;
      }
      return trimmed;
    }

    // 4. Other absolute HTTP/HTTPS URLs (e.g. Unsplash, third-party CDN)
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }

    // 5. Relative storage object path (e.g. "tenant-1/products/burger.webp")
    if (this.baseUrl) {
      const cleanPath = trimmed.replace(/^\/+/, '');
      return `${this.baseUrl}/storage/v1/object/public/${bucket}/${cleanPath}`;
    }

    return trimmed;
  }

  /**
   * Normalizes an image URL to a clean relative storage path for database persistence.
   * If the URL belongs to Supabase Storage, extracts only the object path.
   * If it is an external URL (e.g. Unsplash) or already a relative path, preserves it as is.
   */
  public toRelativeStoragePath(urlOrPath?: string | null): string | undefined {
    if (!urlOrPath || typeof urlOrPath !== 'string') return undefined;
    const trimmed = urlOrPath.trim();
    if (!trimmed) return undefined;

    // Extract object path from Supabase public URL
    const supabaseStorageRegex = /https?:\/\/[^/]+\/storage\/v1\/object\/public\/[^/]+\/(.+)$/;
    const match = trimmed.match(supabaseStorageRegex);
    if (match) {
      return match[1];
    }

    if (trimmed.startsWith('storage://')) {
      return trimmed.replace(/^storage:\/\//, '').replace(/^\/+/, '');
    }

    return trimmed;
  }
}

export const defaultStorageUrlResolver = new StorageUrlResolver();
