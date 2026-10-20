import { buildPreviewHtml, buildRestaurantApiUrl, extractStorefrontSlug, isLinkPreviewBot } from './linkPreview'

/**
 * Path matcher for the routing middleware: one segment, no dots (files), not /api or /assets.
 * `frontend/middleware.ts` must repeat this literal (Vercel reads `config` statically);
 * a test keeps both in sync.
 */
export const previewMatcher = '/((?!api(?:/|$)|assets(?:/|$))[^/.]+)/?'

const FETCH_TIMEOUT_MS = 2500
const CACHE_CONTROL = 'public, max-age=300, s-maxage=300'

export interface StorefrontPreviewOptions {
  /** Backend base URL (e.g. the `VITE_API_URL` env var). */
  apiUrl: string | undefined
  fetchImpl?: typeof fetch
}

/**
 * Returns a preview Response for link-preview bots on a storefront URL, or `undefined`
 * to let the request continue to the SPA. Every failure path fails open.
 */
export async function handleStorefrontPreview(
  request: Request,
  { apiUrl, fetchImpl = fetch }: StorefrontPreviewOptions,
): Promise<Response | undefined> {
  if (!isLinkPreviewBot(request.headers.get('user-agent'))) return undefined

  const url = new URL(request.url)
  const slug = extractStorefrontSlug(url.pathname)
  if (!slug) return undefined

  const endpoint = buildRestaurantApiUrl(apiUrl, slug)
  if (!endpoint) return undefined

  try {
    const upstream = await fetchImpl(endpoint, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!upstream.ok) return undefined
    const html = buildPreviewHtml(await upstream.json(), slug, url.origin)
    if (!html) return undefined
    return new Response(html, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': CACHE_CONTROL },
    })
  } catch {
    return undefined
  }
}
