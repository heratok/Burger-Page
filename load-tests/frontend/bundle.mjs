import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib'
const dist='/workspace/Burger-Page/frontend/dist'
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)])
const files=walk(dist).map(f=>{const b=fs.readFileSync(f);return {f:path.relative(dist,f),raw:b.length,gz:zlib.gzipSync(b).length}})
const sum=(a,k)=>a.reduce((s,x)=>s+x[k],0)
const by=ext=>files.filter(x=>x.f.endsWith(ext))
for(const e of ['.js','.css','.html','.woff2','.png','.jpg','.svg','.webp']){const a=by(e);if(a.length)console.log(e,a.length,'files raw',(sum(a,'raw')/1024).toFixed(0)+'KB gz',(sum(a,'gz')/1024).toFixed(0)+'KB')}
console.log('TOTAL',(sum(files,'raw')/1024).toFixed(0),'KB gz',(sum(files,'gz')/1024).toFixed(0))
console.log('>100KB gz:');files.filter(x=>x.gz>100*1024).forEach(x=>console.log(' ',x.f,(x.raw/1024).toFixed(1),(x.gz/1024).toFixed(1)))
console.log('top css/other:');files.filter(x=>!x.f.endsWith('.js')).sort((a,b)=>b.raw-a.raw).slice(0,8).forEach(x=>console.log(' ',x.f,(x.raw/1024).toFixed(1),(x.gz/1024).toFixed(1)))
const html=fs.readFileSync(dist+'/index.html','utf8');console.log(html)
const init=[...html.matchAll(/(?:src|href)="\/(assets\/[^"]+)"/g)].map(m=>m[1])
console.log('initial html refs gz KB',init.map(i=>{const x=files.find(f=>f.f===i);return i+' '+(x.gz/1024).toFixed(1)}))
