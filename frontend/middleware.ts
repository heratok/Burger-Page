import { next } from '@vercel/functions'
import { handleStorefrontPreview } from './src/core/seo/storefrontPreview'

// Node types are not part of the browser tsconfig; Vercel provides `process` at runtime.
declare const process: { env: Record<string, string | undefined> }

// Keep in sync with `previewMatcher` in src/core/seo/storefrontPreview.ts (tested).
export const config = {
  matcher: ['/((?!api(?:/|$)|assets(?:/|$))[^/.]+)/?'],
}

export default async function middleware(request: Request): Promise<Response> {
  const preview = await handleStorefrontPreview(request, { apiUrl: process.env.VITE_API_URL })
  return preview ?? next()
}
