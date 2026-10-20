import middlewareSource from '../../../middleware.ts?raw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleStorefrontPreview, previewMatcher } from './storefrontPreview'

const BOT = 'WhatsApp/2.23.20.0 A'
const HUMAN = 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120 Safari/537.36'
const API = 'https://api.example.com'

function req(path: string, ua: string | null = BOT, origin = 'https://heratok.app') {
  return new Request(`${origin}${path}`, ua ? { headers: { 'user-agent': ua } } : {})
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

const burger = { slug: 'burger-craft', name: 'Burger <Craft>', tagline: 'Rico & rápido', config: {} }

afterEach(() => vi.restoreAllMocks())

describe('handleStorefrontPreview', () => {
  it('serves escaped preview HTML to a bot', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(burger))
    const res = await handleStorefrontPreview(req('/Burger-Craft'), { apiUrl: API, fetchImpl })
    expect(res).toBeInstanceOf(Response)
    expect(res!.status).toBe(200)
    expect(res!.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(res!.headers.get('cache-control')).toBe('public, max-age=300, s-maxage=300')
    const html = await res!.text()
    expect(html).toContain('og:title" content="Burger &lt;Craft&gt;"')
    expect(html).toContain('Rico &amp; rápido')
    expect(html).toContain('og:url" content="https://heratok.app/burger-craft"')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.example.com/api/restaurant/burger-craft')
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('passes humans through without calling the API', async () => {
    const fetchImpl = vi.fn()
    expect(await handleStorefrontPreview(req('/burger-craft', HUMAN), { apiUrl: API, fetchImpl })).toBeUndefined()
    expect(await handleStorefrontPreview(req('/burger-craft', null), { apiUrl: API, fetchImpl })).toBeUndefined()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each(['/', '/admin', '/login', '/auth', '/a/b', '/logo.jpg'])(
    'passes bots through on %s without calling the API',
    async (path) => {
      const fetchImpl = vi.fn()
      expect(await handleStorefrontPreview(req(path), { apiUrl: API, fetchImpl })).toBeUndefined()
      expect(fetchImpl).not.toHaveBeenCalled()
    },
  )

  it('fails open without an API url', async () => {
    const fetchImpl = vi.fn()
    expect(await handleStorefrontPreview(req('/burger-craft'), { apiUrl: undefined, fetchImpl })).toBeUndefined()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('fails open on non-2xx', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({}, 404))
    expect(await handleStorefrontPreview(req('/nope'), { apiUrl: API, fetchImpl })).toBeUndefined()
  })

  it('fails open on invalid JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('<html>', { status: 200 }))
    expect(await handleStorefrontPreview(req('/burger-craft'), { apiUrl: API, fetchImpl })).toBeUndefined()
  })

  it('fails open on slug mismatch (API default tenant)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(burger))
    expect(await handleStorefrontPreview(req('/other'), { apiUrl: API, fetchImpl })).toBeUndefined()
  })

  it('fails open when fetch rejects or times out', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new DOMException('timeout', 'TimeoutError'))
    expect(await handleStorefrontPreview(req('/burger-craft'), { apiUrl: API, fetchImpl })).toBeUndefined()
  })
})

describe('previewMatcher', () => {
  const re = new RegExp(`^${previewMatcher}$`)
  it.each(['/burger-craft', '/x', '/Burger-Craft'])('matches %s', (p) => {
    expect(re.test(p)).toBe(true)
  })
  it.each(['/', '/assets/index.js', '/assets/', '/api', '/api/restaurant/x', '/logo.jpg', '/favicon.ico', '/a/b'])(
    'skips %s',
    (p) => {
      expect(re.test(p)).toBe(false)
    },
  )
})

describe('middleware.ts', () => {
  it('declares the same matcher literal as previewMatcher', () => {
    expect(middlewareSource).toContain(`matcher: ['${previewMatcher}']`)
  })
})
