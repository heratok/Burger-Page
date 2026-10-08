import { createRequire } from 'node:module'
const require = createRequire('/workspace/Burger-Page/frontend/package.json')
const { chromium } = require('playwright')
const BASE = 'http://127.0.0.1:4173'
const pct = (a, p) => { const s=[...a].sort((x,y)=>x-y); return s.length? s[Math.min(s.length-1, Math.ceil(p/100*s.length)-1)] : null }
const browser = await chromium.launch({ args: ['--no-sandbox','--disable-dev-shm-usage'] })
const out = []
for (const N of (process.argv[2]||'10,25,50').split(',').map(Number)) {
  const t0 = Date.now()
  const res = await Promise.all(Array.from({length:N}, async (_, i) => {
    const slug = 'load-' + String(1 + Math.floor(Math.random()*24)).padStart(2,'0')
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    const r = { slug, ms: null, err: null, s5xx: 0, apiReq: 0, apiMs: [] }
    await page.route(u => !/^(127\.0\.0\.1|localhost)$/.test(new URL(u).hostname), rt => rt.abort())
    const starts = new Map()
    page.on('request', q => { if (q.url().includes(':3001') || q.url().includes('/api/')) { r.apiReq++; starts.set(q, Date.now()) } })
    page.on('response', rs => { if (rs.status() >= 500) r.s5xx++; const s=starts.get(rs.request()); if (s) r.apiMs.push(Date.now()-s) })
    try {
      const t = Date.now()
      await page.goto(`${BASE}/${slug}`, { waitUntil: 'commit', timeout: 90000 })
      await page.getByRole('button', { name: /Agregar .* al carrito/i }).first().waitFor({ state: 'visible', timeout: 90000 })
      r.ms = Date.now() - t
    } catch (e) { r.err = String(e.message).split('\n')[0] }
    await ctx.close()
    return r
  }))
  const ok = res.filter(r => r.ms != null).map(r => r.ms)
  const api = res.flatMap(r => r.apiMs)
  const row = { N, wallSec: ((Date.now()-t0)/1000).toFixed(1), ok: ok.length, fail: res.length-ok.length, p50: pct(ok,50), p95: pct(ok,95), max: Math.max(...ok), s5xx: res.reduce((s,r)=>s+r.s5xx,0), apiReq: res.reduce((s,r)=>s+r.apiReq,0), apiP50: pct(api,50), apiP95: pct(api,95), errs: [...new Set(res.filter(r=>r.err).map(r=>r.err))].slice(0,3) }
  console.log(JSON.stringify(row)); out.push(row)
}
await browser.close()
