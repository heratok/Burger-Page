import { describe, expect, it } from 'vitest'
import {
  buildPreviewHtml,
  buildRestaurantApiUrl,
  escapeHtml,
  extractStorefrontSlug,
  isLinkPreviewBot,
} from './linkPreview'

const ORIGIN = 'https://heratok.app'

describe('isLinkPreviewBot', () => {
  it.each([
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'Facebot',
    'WhatsApp/2.23.20.0 A',
    'Twitterbot/1.0',
    'TelegramBot (like TwitterBot)',
    'Slackbot-LinkExpanding 1.0',
    'LinkedInBot/1.0',
    'Mozilla/5.0 (compatible; Discordbot/2.0)',
    'Pinterest/0.2',
    'SkypeUriPreview Preview/0.5',
    'Mozilla/5.0 (Macintosh) Applebot/0.1',
    'redditbot/1.0',
    'vkShare; +http://vk.com/dev/Share',
    'Mozilla/5.0 (compatible; Embedly/0.2)',
    'WHATSAPP/2.0',
  ])('detects %s', (ua) => {
    expect(isLinkPreviewBot(ua)).toBe(true)
  })

  it.each([
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
    '',
    null,
    undefined,
  ])('ignores %s', (ua) => {
    expect(isLinkPreviewBot(ua)).toBe(false)
  })
})

describe('extractStorefrontSlug', () => {
  it('returns the single path segment lowercased', () => {
    expect(extractStorefrontSlug('/burger-craft')).toBe('burger-craft')
    expect(extractStorefrontSlug('/Burger-Craft/')).toBe('burger-craft')
  })

  it.each([
    '/',
    '',
    '/a/b',
    '/admin',
    '/Admin',
    '/login',
    '/signin',
    '/auth',
    '/admin/orders',
    '/logo.jpg',
    '/assets/index.js',
    '/api',
    '/bad slug',
    '/%E0%A4%A',
  ])('rejects %s', (path) => {
    expect(extractStorefrontSlug(path)).toBeNull()
  })
})

describe('buildRestaurantApiUrl', () => {
  it('appends /api when missing', () => {
    expect(buildRestaurantApiUrl('https://api.example.com', 'foo')).toBe(
      'https://api.example.com/api/restaurant/foo',
    )
  })
  it('does not duplicate /api or trailing slash', () => {
    expect(buildRestaurantApiUrl('https://api.example.com/api/', 'foo')).toBe(
      'https://api.example.com/api/restaurant/foo',
    )
  })
  it('returns null for a missing or non-http base', () => {
    expect(buildRestaurantApiUrl(undefined, 'foo')).toBeNull()
    expect(buildRestaurantApiUrl('', 'foo')).toBeNull()
    expect(buildRestaurantApiUrl('ftp://x', 'foo')).toBeNull()
    expect(buildRestaurantApiUrl('not a url', 'foo')).toBeNull()
  })
})

describe('escapeHtml', () => {
  it('escapes & < > " and apostrophes', () => {
    expect(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;',
    )
  })
})

const restaurant = {
  slug: 'Burger-Craft',
  name: 'Burger Craft',
  tagline: 'Las mejores hamburguesas',
  config: { logoUrl: 'https://cdn.example.com/logo.png' },
}

describe('buildPreviewHtml', () => {
  it('renders og and twitter tags for the restaurant', () => {
    const html = buildPreviewHtml(restaurant, 'burger-craft', ORIGIN)!
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<html lang="es">')
    expect(html).toContain('<meta charset="utf-8"')
    expect(html).toContain('<title>Burger Craft</title>')
    expect(html).toContain('<meta name="description" content="Las mejores hamburguesas"')
    expect(html).toContain('<meta property="og:type" content="website"')
    expect(html).toContain('<meta property="og:site_name" content="Burger Craft"')
    expect(html).toContain('<meta property="og:title" content="Burger Craft"')
    expect(html).toContain('<meta property="og:description" content="Las mejores hamburguesas"')
    expect(html).toContain('<meta property="og:url" content="https://heratok.app/burger-craft"')
    expect(html).toContain('<link rel="canonical" href="https://heratok.app/burger-craft"')
    expect(html).toContain('<meta property="og:image" content="https://cdn.example.com/logo.png"')
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image"')
    expect(html).toContain('<meta name="twitter:title" content="Burger Craft"')
    expect(html).toContain('<meta name="twitter:description" content="Las mejores hamburguesas"')
    expect(html).toContain('<meta name="twitter:image" content="https://cdn.example.com/logo.png"')
  })

  it('matches the requested slug case-insensitively', () => {
    expect(buildPreviewHtml(restaurant, 'BURGER-CRAFT', ORIGIN)).not.toBeNull()
  })

  it('returns null when the response slug differs from the requested one', () => {
    expect(buildPreviewHtml({ ...restaurant, slug: 'burger-craft' }, 'other', ORIGIN)).toBeNull()
  })

  it('returns null for malformed payloads', () => {
    expect(buildPreviewHtml(null, 'x', ORIGIN)).toBeNull()
    expect(buildPreviewHtml('str', 'x', ORIGIN)).toBeNull()
    expect(buildPreviewHtml({ slug: 'x' }, 'x', ORIGIN)).toBeNull()
    expect(buildPreviewHtml({ slug: 'x', name: '  ' }, 'x', ORIGIN)).toBeNull()
  })

  it('falls back to config.name / config.tagline', () => {
    const html = buildPreviewHtml(
      { slug: 'x', config: { name: 'Cfg Name', tagline: 'Cfg tag' } },
      'x',
      ORIGIN,
    )!
    expect(html).toContain('<meta property="og:title" content="Cfg Name"')
    expect(html).toContain('<meta property="og:description" content="Cfg tag"')
  })

  it('uses the Spanish generic description when there is no tagline', () => {
    const html = buildPreviewHtml({ slug: 'x', name: 'N' }, 'x', ORIGIN)!
    expect(html).toContain(
      'content="Haz tu pedido en línea y recíbelo en la puerta de tu casa."',
    )
  })

  it('escapes every interpolated value', () => {
    const html = buildPreviewHtml(
      {
        slug: 'x',
        name: `"><script>alert(1)</script>`,
        tagline: `a & b 'c' <img src=x onerror=1>`,
        config: { logoUrl: `https://cdn.example.com/a.png?x="><script>` },
      },
      'x',
      ORIGIN,
    )!
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img')
    expect(html).toContain('&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('a &amp; b &#39;c&#39; &lt;img src=x onerror=1&gt;')
  })

  it('resolves root-relative logos against the request origin', () => {
    const html = buildPreviewHtml(
      { slug: 'x', name: 'N', config: { logoUrl: '/uploads/l.png' } },
      'x',
      ORIGIN,
    )!
    expect(html).toContain('<meta property="og:image" content="https://heratok.app/uploads/l.png"')
    expect(html).toContain('summary_large_image')
  })

  it.each([
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
    '//evil.example.com/x.png',
    'ftp://x/y.png',
    '',
    'logo.png',
  ])('falls back to /logo.jpg and summary card for image %s', (logoUrl) => {
    const html = buildPreviewHtml({ slug: 'x', name: 'N', config: { logoUrl } }, 'x', ORIGIN)!
    expect(html).toContain('<meta property="og:image" content="https://heratok.app/logo.jpg"')
    expect(html).toContain('<meta name="twitter:card" content="summary"')
    expect(html).not.toContain('summary_large_image')
    expect(html).not.toContain('javascript:')
  })

  it('lowercases the slug in canonical URLs', () => {
    const html = buildPreviewHtml({ slug: 'MiSlug', name: 'N' }, 'mislug', ORIGIN)!
    expect(html).toContain('href="https://heratok.app/mislug"')
  })
})
