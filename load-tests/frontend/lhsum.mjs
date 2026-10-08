import fs from 'node:fs'
const med=a=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)]}
for(const p of ['mobile','desktop']){
 const rs=[1,2,3].map(i=>JSON.parse(fs.readFileSync(`lh/${p}-${i}.json`)))
 const g=(r,k)=>r.audits[k].numericValue
 const row={perf:rs.map(r=>Math.round(r.categories.performance.score*100))}
 console.log(p,'perf',row.perf, 'median',med(row.perf))
 for(const [n,k] of [['FCP','first-contentful-paint'],['LCP','largest-contentful-paint'],['TBT','total-blocking-time'],['CLS','cumulative-layout-shift'],['SI','speed-index'],['transferB','total-byte-weight'],['TTI','interactive']]) {
  const v=rs.map(r=>g(r,k)); console.log(' ',n,v.map(x=>+x.toFixed(3)),'median',+med(v).toFixed(3))}
 const r=rs[1]
 const opp=Object.values(r.audits).filter(a=>a.score!==null&&a.score<0.9&&a.scoreDisplayMode!=='informative'&&a.scoreDisplayMode!=='notApplicable'&&a.scoreDisplayMode!=='manual').sort((a,b)=>(b.details?.overallSavingsMs||0)-(a.details?.overallSavingsMs||0)).slice(0,8)
 console.log(' top audits (run2):');opp.forEach(a=>console.log('  -',a.id,a.displayValue||'',a.details?.overallSavingsMs?('save '+Math.round(a.details.overallSavingsMs)+'ms'):'',a.details?.overallSavingsBytes?('bytes '+Math.round(a.details.overallSavingsBytes/1024)+'KB'):''))
 console.log(' LCP el:',JSON.stringify(r.audits['largest-contentful-paint-element'].details?.items?.[0]?.items?.[0]?.node?.snippet||'').slice(0,160))
 console.log(' runWarnings',r.runWarnings)
}
