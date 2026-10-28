import {createServer} from 'vite';
import {chromium,webkit} from 'playwright';
import {mkdirSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';

// Test-only real-clock comparison. The real session starts at 555 with 30
// balls. Only the renderer's score is overridden, so diagnostic4000 never
// bypasses production3500 termination. No virtual clock, auto-resume or guard
// overrides. Arrival/loss peaks are covered separately by browser tests.
const [baseArg,headArg,outArg,engine='chromium',quality='standard']=process.argv.slice(2);
if(!baseArg||!headArg||!outArg||!['chromium','webkit'].includes(engine)||!['standard','low'].includes(quality))throw Error('BASE HEAD OUT chromium|webkit standard|low');
const roots={base:resolve(baseArg),head:resolve(headArg)},out=resolve(outArg);
mkdirSync(out,{recursive:true});
function manifest(root,dir='src'){
  return Object.fromEntries(readdirSync(join(root,dir),{withFileTypes:true}).flatMap(e=>{
    const p=join(dir,e.name);
    return e.isDirectory()?Object.entries(manifest(root,p)):[[p,createHash('sha256').update(readFileSync(join(root,p))).digest('hex')]];
  }).sort(([a],[b])=>a.localeCompare(b)));
}
const summaries=[];let browser;
try{
 browser=await ({chromium,webkit}[engine]).launch({headless:true,...(engine==='chromium'?{args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']}: {})});
 for(const renderScore of [1500,2600,3000,4000])for(const variant of renderScore===2600||renderScore===4000?['head','base']:['base','head']){
  const root=roots[variant],source=manifest(root),errors=[],blocked=[];
  const server=await createServer({root,configFile:false,plugins:[{name:'test-only-render-stage',enforce:'pre',transform(s,id){
   if(id.endsWith('/src/render/createView.ts')){
    const anchor='      const reducedMotion=';
    if(!s.includes(anchor))throw Error('Diagnostic anchor missing');
    return s.replace(anchor,'      snapshot={...snapshot,score:window.__renderStage??snapshot.score};\n'+anchor);
   }
  }}],server:{host:'127.0.0.1',port:4192,strictPort:true,fs:{allow:[...Object.values(roots)]},watch:{ignored:['**/docs/**','**/artifacts/**']}}});
  let context;
  try{
   await server.listen();
   context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
   const page=await context.newPage();
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4192'?r.continue():(blocked.push(r.request().url()),r.abort()));
   await page.goto('http://127.0.0.1:4192/tests/fixtures/stage3.html');
   await page.getByRole('button',{name:'設定',exact:true}).click();
   await page.getByLabel('描画品質',{exact:true}).selectOption(quality);
   await page.getByRole('button',{name:'戻る',exact:true}).click();
   await page.getByRole('button',{name:'はじめる',exact:true}).click();
   await page.waitForFunction(()=>window.stage3.snapshot().phase==='running',null,{timeout:60000});
   await page.evaluate(score=>{window.__renderStage=score;window.stage3.show(555);window.stage3.autoPlay(true);},renderScore);
   const data=await page.evaluate(()=>new Promise(resolve=>{
    const first=window.stage3.snapshot(),begin=performance.now(),samples=[];
    let last=begin;
    const memory=()=>performance.memory?.usedJSHeapSize??null;
    const initialHeap=memory();
    function frame(now){
     const s=window.stage3.snapshot();
     samples.push({wallMs:now-begin,intervalMs:now-last,simTime:s.simTime,physicalScore:s.score,phase:s.phase,balls:s.balls.length});last=now;
     if(now-begin<60000){requestAnimationFrame(frame);return;}
     const sorted=samples.map(s=>s.intervalMs).sort((a,b)=>a-b),p=q=>sorted[Math.ceil(sorted.length*q)-1];
     const fraction25=sorted.filter(n=>n<=25).length/sorted.length;
     const continuous30=samples.every(s=>s.phase==='running'&&s.balls===30),simSeconds=s.simTime-first.simTime;
     resolve({durationMs:now-begin,p50:p(.5),p95:p(.95),p99:p(.99),fraction25,simSeconds,continuous30,
      targetMet:continuous30&&simSeconds>=59&&p(.95)<=25&&fraction25>=.95,
      samples,initialHeap,finalHeap:memory(),first,final:s,resources:window.stage3.resources(),
      drawingSize:{width:document.querySelector('canvas').width,height:document.querySelector('canvas').height}});
    }
    requestAnimationFrame(frame);
   }));
   const sourceStable=JSON.stringify(source)===JSON.stringify(manifest(root));
   const row={variant,renderScore,physicalStart:555,engine,browser:browser.version(),quality,viewport:{width:390,height:844,dpr:2},source,sourceStable,errors,blocked,...data};
   writeFileSync(join(out,variant+'-'+renderScore+'.json.gz'),gzipSync(JSON.stringify(row)));
   await page.screenshot({path:join(out,variant+'-'+renderScore+'.png')});
   const {samples,first,final,source:omitted,...summary}=row;
   summaries.push(summary);writeFileSync(join(out,'summary.json'),JSON.stringify(summaries,null,2));
   console.log('MEASUREMENT '+JSON.stringify(summary));
   if(errors.length||blocked.length||!sourceStable||!data.continuous30)throw Error('Measurement failed: errors, source drift or loss of continuous30; raw failure retained');
  }finally{await context?.close();await server.close();}
 }
}finally{await browser?.close();}
// Performance acceptance and functional execution are separate. Never turn a
// paused scene into a fast-frame success. Preserve unmet targets in the report.
const comparisons=[1500,2600,3000,4000].map(score=>{
 const a=summaries.find(r=>r.variant==='base'&&r.renderScore===score),b=summaries.find(r=>r.variant==='head'&&r.renderScore===score);
 return {score,base:a,head:b,p95ChangeMs:b.p95-a.p95,simulationChangeSeconds:b.simSeconds-a.simSeconds};
});
writeFileSync(join(out,'comparison.json'),JSON.stringify({schema:'gameplay-render-comparison-v1',repeats:1,comparisons,limitations:['Linux software rendering; real phones unverified.','Physical start555 and renderer-only stage override; no playable4000.','Heap values may be quantized and include the collector; not a leak proof.','Single paired observation per stage/engine/quality; not statistical superiority.']},null,2));
console.log('COMPARISON '+JSON.stringify(comparisons.map(({score,p95ChangeMs,simulationChangeSeconds,base,head})=>({score,p95ChangeMs,simulationChangeSeconds,baseTarget:base.targetMet,headTarget:head.targetMet}))));
