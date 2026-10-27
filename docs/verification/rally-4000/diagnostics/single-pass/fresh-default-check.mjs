import {createHash} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {createWriteStream,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium,webkit,devices} from '@playwright/test';

// Run from the repository root. This diagnostic adds no production/test API.
const {pngPixels}=await import(pathToFileURL(resolve('tests/helpers/pngPixels.ts')).href);
const root=resolve('docs/verification/rally-4000/diagnostics/single-pass/fresh-default');
mkdirSync(root,{recursive:true});
const port=Number(process.env.RALLY_FRESH_CHECK_PORT??4183),url=`http://127.0.0.1:${port}`;
const serverLog=createWriteStream(resolve(root,'vite.log'));
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:['ignore','pipe','pipe']});
server.stdout.pipe(serverLog);server.stderr.pipe(serverLog);
let browser;
const sha=data=>createHash('sha256').update(data).digest('hex');
const productionSrcTree=execFileSync('git',['rev-parse','HEAD:src'],{encoding:'utf8'}).trim();
const sourceFiles=['src/render/rallyEffects.ts','src/render/createView.ts','tests/helpers/rallyHarness.ts',
 'node_modules/three/src/renderers/WebGLRenderer.js','node_modules/three/src/renderers/shaders/ShaderLib/meshbasic.glsl.js'];
const sources=sourceFiles.map(file=>({file,sha256:sha(readFileSync(file))}));
for(const file of sourceFiles){
 const lines=readFileSync(file,'utf8').split('\n');
 const excerpt=file.endsWith('WebGLRenderer.js')?lines.slice(2150,2190).join('\n'):
  file.endsWith('meshbasic.glsl.js')?lines.join('\n'):file.endsWith('rallyEffects.ts')?lines.slice(0,24).join('\n'):'';
 if(excerpt)writeFileSync(resolve(root,file.split('/').at(-1)+'.excerpt.txt'),excerpt+'\n');
}
const rows=[];
const summary={productionSrcTree,threeVersion:JSON.parse(readFileSync('node_modules/three/package.json','utf8')).version,sources,
 method:'fresh null production default before restore; full-frame fresh default vs explicit false and then true, exact decoded pixels; no legacy fireworks or opponent-hit transient facts',rows};
function comparison(a,b){
 if(a.width!==b.width||a.height!==b.height||a.channels!==b.channels)throw Error('PNG dimensions differ');
 let changedPixels=0,maxChannelDelta=0;
 for(let pixel=0;pixel<a.width*a.height;pixel++){
  let changed=false;
  for(let channel=0;channel<a.channels;channel++){
   const index=pixel*a.channels+channel,delta=Math.abs(a.pixels[index]-b.pixels[index]);
   if(delta)changed=true;maxChannelDelta=Math.max(maxChannelDelta,delta);
  }
  if(changed)changedPixels++;
 }
 return {changedPixels,maxChannelDelta};
}
try{
 let ready=false;
 for(let attempt=0;attempt<300;attempt++){
  try{ready=(await fetch(url)).ok;}catch{}
  if(ready)break;
  if(server.exitCode!==null)throw Error(`Vite exited${server.exitCode}`);
  await new Promise(done=>setTimeout(done,100));
 }
 if(!ready)throw Error('Vite startup deadline');
 for(const engine of ['chromium','webkit']){
  browser=await (engine==='chromium'?chromium:webkit).launch(engine==='chromium'?{args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']}:{ });
  const context=await browser.newContext({...engine==='webkit'?devices['iPhone 13']:{},viewport:{width:390,height:844}});
  const external=[],errors=[];
  await context.route('**/*',route=>{
   if(new URL(route.request().url()).hostname==='127.0.0.1')return route.continue();
   external.push(route.request().url());return route.abort();
  });
  await context.routeWebSocket('**/*',socket=>socket.close());
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`${url}/tests/fixtures/rally.html`);await page.waitForFunction(()=>!!window.rally);
  for(const quality of ['standard','low'])for(const name of ['2000-transition','4000-peak','4000-middle','loss100-finishing']){
   await page.evaluate(({quality,name})=>{
    const h=window.rally;h.singlePass(null,quality);
    if(name==='loss100-finishing'){h.loss(100,4,false);h.time(20.37);h.finish();h.advance(.5);}
    else h.show(name==='2000-transition'?2000:4000,name==='2000-transition'?20.65:name==='4000-peak'?20.35:22.5);
    // First draw by these new materials is the actual production default.
    h.singlePass(null,quality);h.restore();
   },{quality,name});
   const frozen=await page.evaluate(()=>({snapshot:window.rally.snapshot(),state:window.rally.state(),finishing:window.rally.finishing()}));
   const freshInfo=await page.evaluate(quality=>window.rally.singlePass(null,quality),quality);
   const freshPNG=await page.screenshot(),fresh=pngPixels(freshPNG);
   const controlInfo=await page.evaluate(quality=>window.rally.singlePass(false,quality),quality);
   const controlPNG=await page.screenshot(),control=pngPixels(controlPNG);
   const cachedInfo=await page.evaluate(quality=>window.rally.singlePass(true,quality),quality);
   const cachedPNG=await page.screenshot(),cached=pngPixels(cachedPNG);
   const after=await page.evaluate(()=>({snapshot:window.rally.snapshot(),state:window.rally.state(),finishing:window.rally.finishing()}));
   const prefix=`${engine}-${quality}-${name}`;
   for(const [suffix,png]of[['fresh-default',freshPNG],['explicit-false',controlPNG],['false-then-true',cachedPNG]])writeFileSync(resolve(root,`${prefix}-${suffix}.png`),png);
   const row={engine,quality,name,runId:frozen.snapshot.runId,score:frozen.snapshot.score,time:frozen.snapshot.simTime,finishing:frozen.finishing,
    width:fresh.width,height:fresh.height,channels:fresh.channels,freshInfo,controlInfo,cachedInfo,
    freshPixelSHA256:sha(fresh.pixels),controlPixelSHA256:sha(control.pixels),cachedPixelSHA256:sha(cached.pixels),
    freshVersusFalse:comparison(fresh,control),freshVersusCachedTrue:comparison(fresh,cached),
    frozenStateUnchanged:JSON.stringify(frozen)===JSON.stringify(after),legacyFireworkEffectFacts:0,opponentHitTransientFacts:0};
   rows.push(row);writeFileSync(resolve(root,'results.json'),JSON.stringify(summary,null,2)+'\n');
   console.log(JSON.stringify(row));
   if(row.freshVersusFalse.changedPixels||row.freshVersusCachedTrue.changedPixels||!row.frozenStateUnchanged)throw Error(`Fresh default mismatch:${prefix}`);
   if(name==='loss100-finishing'&&!row.finishing)throw Error('Expected finishing clock');
  }
  if(external.length||errors.length)throw Error(JSON.stringify({external,errors}));
  await context.close();await browser.close();browser=null;
 }
 summary.completed=true;summary.comparisons=rows.length;summary.allExact=rows.every(row=>row.freshVersusFalse.changedPixels===0&&row.freshVersusCachedTrue.changedPixels===0&&row.frozenStateUnchanged);
 summary.sourceStable=sources.every(source=>source.sha256===sha(readFileSync(source.file)));
 writeFileSync(resolve(root,'results.json'),JSON.stringify(summary,null,2)+'\n');
 if(!summary.sourceStable)throw Error('Source changed during diagnostic');
}finally{
 if(browser)await browser.close();
 server.kill('SIGTERM');serverLog.end();
}
