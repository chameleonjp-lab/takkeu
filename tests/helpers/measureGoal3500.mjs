import {createServer} from 'vite';
import {chromium,webkit} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const [rootArg,outArg]=process.argv.slice(2),root=resolve(rootArg),out=resolve(outArg);mkdirSync(out,{recursive:true});
const server=await createServer({root,configFile:false,server:{host:'127.0.0.1',port:4189,strictPort:true}});await server.listen();
const rows=[];
try{for(const [engine,type]of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch({headless:true,...(engine==='chromium'?{args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']}: {})});
 try{for(const quality of ['standard','low']){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4189'?r.continue():r.abort());
  await page.goto('http://127.0.0.1:4189/tests/fixtures/stage3.html');
  await page.getByRole('button',{name:'設定',exact:true}).click();await page.getByLabel('描画品質',{exact:true}).selectOption(quality);await page.getByRole('button',{name:'戻る',exact:true}).click();
  await page.getByRole('button',{name:'はじめる',exact:true}).click();await page.waitForFunction(()=>window.stage3.snapshot().phase==='running');
  await page.evaluate(()=>{window.stage3.show(555);window.stage3.autoPlay(true);});
  const result=await page.evaluate(()=>new Promise(resolve=>{
   const initial=window.stage3.snapshot(),begin=performance.now(),samples=[];let last=begin;
   function frame(now){const s=window.stage3.snapshot();samples.push({wall:now-begin,interval:now-last,phase:s.phase,sim:s.simTime,score:s.score,balls:s.balls.length,resources:window.stage3.resources()});last=now;
    if(now-begin<60000){requestAnimationFrame(frame);return;}
    const v=samples.map(s=>s.interval).sort((a,b)=>a-b),p=q=>v[Math.ceil(v.length*q)-1];
    const seconds=s.simTime-initial.simTime,fraction=v.filter(x=>x<=25).length/v.length,continuous=samples.every(s=>s.phase==='running'&&s.balls===30);
    resolve({duration:now-begin,p50:p(.5),p95:p(.95),p99:p(.99),simSeconds:seconds,fractionAtMost25ms:fraction,continuous30:continuous,targetMet:continuous&&seconds>=59&&fraction>=.95&&p(.95)<=25,initial,final:s,samples});}
   requestAnimationFrame(frame);
  }));
  rows.push({engine,quality,errors,...result});writeFileSync(`${out}/${engine}-${quality}.json`,JSON.stringify(rows.at(-1),null,2));console.log(JSON.stringify({engine,quality,...Object.fromEntries(Object.entries(result).filter(([k])=>!['samples','initial','final'].includes(k)))}));await context.close();
 }}finally{await browser.close();}
}}finally{await server.close();writeFileSync(`${out}/summary.json`,JSON.stringify(rows.map(({samples,initial,final,...r})=>r),null,2));}
