/**
 * Pure helpers for per-restaurant link previews (Open Graph / Twitter cards).
 * Used by the Vercel routing middleware (`frontend/middleware.ts`); no I/O here.
 */

const BOT_USER_AGENT =
  /facebookexternalhit|facebot|whatsapp|twitterbot|telegrambot|slackbot|linkedinbot|discordbot|pinterest|skypeuripreview|applebot|redditbot|vkshare|embedly/i

const RESERVED_SLUGS = new Set(['admin', 'login', 'signin', 'auth', 'api', 'assets'])
const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]*$/

const FALLBACK_DESCRIPTION = 'Haz tu pedido en línea y recíbelo en la puerta de tu casa.'
const FALLBACK_IMAGE_PATH = '/logo.jpg'

export function isLinkPreviewBot(userAgent: string | null | undefined): boolean {
  return !!userAgent && BOT_USER_AGENT.test(userAgent)
}

/** Single, non-reserved, file-less path segment -> lowercase slug; otherwise null. */
export function extractStorefrontSlug(pathname: string): string | null {
  const segments = pathname.split('/').filter((segment) => segment.length > 0)
  if (segments.length !== 1) return null
  const slug = segments[0].toLowerCase()
  if (RESERVED_SLUGS.has(slug) || !SLUG_PATTERN.test(slug)) return null
  return slug
}

/** `{base}/api/restaurant/{slug}`; `base` may or may not already end in `/api`. */
export function buildRestaurantApiUrl(base: string | undefined, slug: string): string | null {
  if (!base) return null
  let parsed: URL
  try {
    parsed = new URL(base)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
  let root = base.replace(/\/+$/, '')
  if (!root.endsWith('/api')) root = `${root}/api`
  return `${root}/restaurant/${encodeURIComponent(slug)}`
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** Absolute http(s) URL for the logo, or null when unusable (unsafe scheme, relative, empty). */
function resolveImage(logoUrl: unknown, origin: string): string | null {
  const raw = text(logoUrl)
  if (!raw) return null
  const candidate = raw.startsWith('/') && !raw.startsWith('//') ? origin + raw : raw
  try {
    const parsed = new URL(candidate)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null
  } catch {
    return null
  }
}

/**
 * Builds the preview document, or null when the payload is unusable or describes a
 * different restaurant than requested (the API falls back to a default tenant).
 */
export function buildPreviewHtml(
  payload: unknown,
  requestedSlug: string,
  origin: string,
): string | null {
  if (!payload || typeof payload !== 'object') return null
  const data = payload as Record<string, unknown>
  const config = (data.config && typeof data.config === 'object' ? data.config : {}) as Record<
    string,
    unknown
  >

  const slug = text(data.slug)?.toLowerCase()
  if (!slug || slug !== requestedSlug.toLowerCase()) return null

  const name = text(data.name) ?? text(config.name)
  if (!name) return null
  const description = text(data.tagline) ?? text(config.tagline) ?? FALLBACK_DESCRIPTION

  const logo = resolveImage(config.logoUrl, origin)
  const image = logo ?? `${origin}${FALLBACK_IMAGE_PATH}`
  const card = logo ? 'summary_large_image' : 'summary'
  const url = `${origin}/${slug}`

  const e = escapeHtml
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${e(name)}</title>
<meta name="description" content="${e(description)}" />
<link rel="canonical" href="${e(url)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${e(name)}" />
<meta property="og:title" content="${e(name)}" />
<meta property="og:description" content="${e(description)}" />
<meta property="og:url" content="${e(url)}" />
<meta property="og:image" content="${e(image)}" />
<meta name="twitter:card" content="${card}" />
<meta name="twitter:title" content="${e(name)}" />
<meta name="twitter:description" content="${e(description)}" />
<meta name="twitter:image" content="${e(image)}" />
</head>
<body></body>
</html>
`
}
