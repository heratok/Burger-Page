import { createRequire } from 'node:module'
const require = createRequire('/workspace/Burger-Page/frontend/package.json')
const { chromium } = require('playwright')
const BASE='http://127.0.0.1:4173', slug='load-07'
const browser = await chromium.launch({ args:['--no-sandbox','--disable-dev-shm-usage'] })
const ctx = await browser.newContext({ viewport:{width:390,height:844} })
const page = await ctx.newPage()
await page.route(u => !/^(127\.0\.0\.1|localhost)$/.test(new URL(u).hostname), rt => rt.abort())
const reqs=[]; const t0={}
page.on('requestfinished', async q => { const r=await q.response(); const sz=(await q.sizes()).responseBodySize; reqs.push({u:q.url().replace(BASE,''),type:q.resourceType(),status:r.status(),size:sz}) })
const T={}; const mark=(k,s)=>T[k]=Date.now()-s
let s=Date.now()
await page.goto(`${BASE}/${slug}`,{waitUntil:'commit'})
await page.getByRole('button',{name:/Agregar .* al carrito/i}).first().waitFor({state:'visible'}); mark('load_to_menu_ms',s)
await page.waitForLoadState('networkidle')
console.log('initial loads:'); const js=reqs.filter(r=>r.type==='script'); console.log(' js files',js.length,'bytes(wire)',js.reduce((a,b)=>a+b.size,0), js.map(j=>j.u.split('/').pop()+':'+(j.size/1024).toFixed(0)+'K').join(' ')); console.log(' api',reqs.filter(r=>r.u.includes('3001')||r.u.startsWith('/api')).map(r=>r.u))
const dialogAdd=page.getByRole('button',{name:/Agregar · \$/i})
const cartBtn=page.getByRole('button',{name:/Ver orden/i}).first()
const checkout=page.getByRole('button',{name:/Continuar con el pedido|Iniciar Pedido|Completar Pedido|Confirmar|Finalizar|Pedir/i}).first()
let n=0
s=Date.now()
for(;;){
  await page.getByRole('button',{name:/Agregar .* al carrito/i}).nth(n%3).click()
  await dialogAdd.waitFor({state:'visible'}); const s2=Date.now(); await dialogAdd.click(); await dialogAdd.waitFor({state:'hidden'}); if(n===0)T.add_to_cart_modal_ms=Date.now()-s2; n++
  if(n>=6)break
  await cartBtn.click(); await page.waitForTimeout(300)
  const b=await checkout.isEnabled().catch(()=>false)
  if(b)break
  await page.keyboard.press('Escape'); await page.waitForTimeout(200)
}
T.add_items_total_ms=Date.now()-s; T.items=n
if(!(await page.getByRole('heading',{name:/Tu pedido/i}).isVisible())) await cartBtn.click()
s=Date.now(); await checkout.click(); await page.getByPlaceholder('Tu nombre').waitFor(); mark('open_checkout_ms',s)
await page.getByPlaceholder('Tu nombre').fill('Load Test'); await page.getByPlaceholder('3001234567').fill('3001234567'); await page.getByPlaceholder('Calle 123 #45-67').fill('Calle 1 # 2-3'); await page.getByPlaceholder('Tu barrio').fill('Centro')
const orderResp=page.waitForResponse(r=>/\/orders/.test(r.url())&&r.request().method()==='POST',{timeout:15000}).catch(()=>null)
s=Date.now(); await page.getByRole('button',{name:/Enviar pedido por WhatsApp/i}).click()
const rr=await orderResp; mark('submit_to_order_response_ms',s); T.order_status=rr?.status()
await page.waitForTimeout(500)
console.log(JSON.stringify(T,null,1))
await browser.close()
