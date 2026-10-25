import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
const directory=new URL('./',import.meta.url);
const browser=await chromium.launch({args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
const blocked=[],errors=[];
await context.route('**/*',route=>{
 if(new URL(route.request().url()).origin==='http://127.0.0.1:4176')return route.continue();
 blocked.push(route.request().url());return route.abort();
});
const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto('http://127.0.0.1:4176/tests/fixtures/rally-gl.html');
 await page.waitForFunction(()=>Boolean(window.rallyGl),{},{timeout:60000});
 const results=[];
 for(const quality of ['standard','low'])for(const frame of ['peak','middle']){
  const result=await page.evaluate(async({quality,frame})=>{
   const canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl2');
   const extension=gl.getExtension('EXT_disjoint_timer_query_webgl2');
   async function run(fence){
    const held=[],remove=gl.deleteQuery.bind(gl),finish=gl.finish.bind(gl),read=gl.readPixels.bind(gl);
    const pixels=fence?new Uint8Array(canvas.width*canvas.height*4):null;
    gl.deleteQuery=query=>{if(query)held.push(query);};
    if(fence)gl.finish=()=>{finish();read(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);};
    try{
     const started=performance.now();
     const profile=await window.rallyGl.profile(frame,quality,fence?3:4);
     const deadline=performance.now()+15000;let polls=0,available=[];
     do{
      await new Promise(resolve=>requestAnimationFrame(resolve));polls++;
      available=held.map(query=>Boolean(gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE)));
     }while(held.length&&available.some(value=>!value)&&performance.now()<deadline);
     const disjoint=extension?Boolean(gl.getParameter(extension.GPU_DISJOINT_EXT)):null;
     const queryResults=held.map((query,index)=>({index,available:available[index]??false,
      gpuMs:available[index]&&!disjoint?Number(gl.getQueryParameter(query,gl.QUERY_RESULT))/1e6:null}));
     let index=0;
     for(const block of profile.blocks)for(const sample of block.samples){sample.deferredGpuMs=queryResults[index]?.gpuMs??null;index++;}
     return {fence,wallMs:performance.now()-started,polls,disjoint,queryCount:held.length,queryResults,profile};
    }finally{gl.deleteQuery=remove;gl.finish=finish;for(const query of held)remove(query);}
   }
   const timer=await run(false);
   const fallback=timer.queryResults.some(query=>Number.isFinite(query.gpuMs)&&query.gpuMs>0)?null:await run(true);
   return {quality,frame,timer,fallback};
  },{quality,frame});
  for(const[stage,row]of Object.entries({timer:result.timer,fallback:result.fallback})){
   if(!row)continue;
   for(const[name,url]of Object.entries(row.profile.captures)){
    const file=`gpu-query-${quality}-${frame}-${stage}-${name}.png`;
    writeFileSync(new URL(file,directory),Buffer.from(url.split(',')[1],'base64'));row.profile.captures[name]=file;
   }
  }
  results.push(result);
  const summary={quality,frame,queryCount:result.timer.queryCount,available:result.timer.queryResults.filter(query=>query.available).length,disjoint:result.timer.disjoint,modes:[]};
  const median=values=>{const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);return sorted.length?sorted[Math.floor(sorted.length/2)]:null;};
  for(const mode of ['normal','single-pass','hidden','scissor']){
   const samples=result.timer.profile.blocks.filter(block=>block.mode===mode).flatMap(block=>block.samples);
   summary.modes.push({mode,gpuMedianMs:median(samples.map(sample=>sample.deferredGpuMs)),submitMedianMs:median(samples.map(sample=>sample.renderSubmitMs)),fenceMedianMs:median((result.fallback?.profile.blocks??[]).filter(block=>block.mode===mode).flatMap(block=>block.samples).map(sample=>sample.totalMs))});
  }
  process.stdout.write(JSON.stringify(summary)+'\n');
 }
 writeFileSync(new URL('gpu-query-results.json',directory),JSON.stringify({sourceCommit:'d30aa196f2faccd88fab36de4b94bb585c21b464',sourceTree:'47bd0f370ad169de00c77b37bb74429b63020d44',diagnosticOnly:true,contextTracing:false,blocked,errors,results},null,2)+'\n');
 if(blocked.length||errors.length)throw new Error(JSON.stringify({blocked,errors}));
}finally{await browser.close();}
