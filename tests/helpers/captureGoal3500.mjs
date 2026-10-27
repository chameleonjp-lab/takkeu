import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const [rootArg,outArg]=process.argv.slice(2),root=resolve(rootArg),out=resolve(outArg);mkdirSync(out,{recursive:true});
const server=await createServer({root,configFile:false,server:{host:'127.0.0.1',port:4190,strictPort:true}});await server.listen();
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const context=await browser.newContext({viewport:{width:1024,height:768},deviceScaleFactor:1});
await context.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4190'?r.continue():r.abort());await context.routeWebSocket('**/*',s=>s.close());
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const loadRows=[];
try{
 await page.goto('http://127.0.0.1:4190/tests/fixtures/rally.html');await page.waitForFunction(()=>!!window.rally);
 for(const quality of ['standard','low']){
  await page.evaluate(q=>window.rally.setQuality(q),quality);
  for(const score of [1500,2600,3000,3250,3499,3500])for(const phase of ['normal','arrival']){
   const row=await page.evaluate(({score,phase})=>{
    window.rally.show(score);window.rally.legacyFireworks();
    // Same30 balls, no particle stress: allow the seeded .7s fireworks to expire.
    // Normal is beyond every old/new lifetime; arrival retains a live milestone.
    const time=phase==='normal'?26:20.75;window.rally.time(time);
    const samples=[];for(let i=0;i<30;i++){const begin=performance.now();window.rally.capture(time+i/6000);samples.push(performance.now()-begin);}
    const snap=window.rally.snapshot();return {samples,resources:window.rally.resources(),snapshot:{score:snap.score,balls:snap.balls.length,simTime:snap.simTime},stats:window.rally.stats()};
   },{score,phase});loadRows.push({quality,score,phase,...row});
  }
  // Matched content-clock captures, separate from actual60-second performance.
  for(const [score,loss] of [[3000,0],[3500,0],[3200,100],[3000,99]]){
   const name=`${score}-loss${loss}-${quality}`,dir=`${out}/captures/${name}`;mkdirSync(dir,{recursive:true});
   await page.evaluate(({score,loss})=>{if(loss)window.rally.overlap(score,loss,4);else window.rally.show(score);},{score,loss});
   const fps=60,seconds=3.2,frames=Math.round(fps*seconds);
   for(let frame=0;frame<frames;frame++){
    const png=await page.evaluate(time=>window.rally.capture(time),20+frame/fps);
    writeFileSync(`${dir}/${String(frame).padStart(4,'0')}.png`,Buffer.from(png.split(',')[1],'base64'));
   }
   writeFileSync(`${dir}/capture.json`,JSON.stringify({name,score,loss,quality,fps,seconds,frames,width:1024,height:768,syntheticStress:!!loss,userAgent:await page.evaluate(()=>navigator.userAgent)},null,2));
   console.log(name,'captured',frames);
  }
 }
}finally{
 writeFileSync(`${out}/render-load.json`,JSON.stringify({method:'30-ball fixed-pose render+readback+PNG encode wall ms; not gameplay frame times',sourceConfigSHA256:createHash('sha256').update(readFileSync(`${root}/src/game/config.ts`)).digest('hex'),rows:loadRows,errors},null,2));
 await context.close();await browser.close();await server.close();
}
