// Supplement the package browser suite with strokes during real offline decay.
// Usage (Vite at 4173, no production API calls): node .../check-overlap.mjs
import { chromium, webkit } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { wav } from '../../../tests/helpers/wav.ts';
const dir=new URL('.',import.meta.url).pathname, summary=[];
for(const [engine,type] of Object.entries({chromium,webkit})) {
  const browser=await type.launch();
  try {
    const context=await browser.newContext();const traffic=[];
    await context.route('https://*.supabase.co/**',route=>{traffic.push(route.request().url());return route.abort();});
    const page=await context.newPage();await page.goto('http://127.0.0.1:4173/');
    const rows=await page.evaluate(async()=>{
      const audioUrl='/src/audio/audio.ts',configUrl='/src/game/config.ts';
      const {createAudio}=await import(audioUrl),{DEFAULT_CONFIG}=await import(configUrl);const rows=[];
      for(const rate of [44100,48000])for(const at of [.006,.025,.06])for(const kind of ['success','warning']) {
        const native=new OfflineAudioContext(1,rate/2,rate);
        const ctx=new Proxy(native,{get(target,key){
          if(key==='state')return 'running';if(['resume','close','suspend'].includes(String(key)))return async()=>{};
          const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
        },set(target,key,value){return Reflect.set(target,key,value,target);}});
        const audio=createAudio(DEFAULT_CONFIG,()=>ctx);audio.reset('overlap');audio.setVolume(1);
        if(!await audio.unlock())throw new Error('offline lifecycle adapter failed');
        let id=0;
        const burst=(warning=false)=>audio.consume(Array.from({length:8},()=>({id:String(++id),runId:'overlap',time:native.currentTime,ballId:id,
          kind:warning?'smash-warning':'player-hit',rallyScore:555,smashReturn:true})));
        burst(kind==='warning');const paused=native.suspend(at),rendered=native.startRendering();
        await paused;const actualAt=native.currentTime;burst();await native.resume();
        const signal=Array.from((await rendered).getChannelData(0));
        rows.push({rate,kind,requestedAt:at,actualAt,signal,
          finite:signal.every(Number.isFinite),peak:signal.reduce((n,v)=>Math.max(n,Math.abs(v)),0),
          rms:Math.sqrt(signal.reduce((n,v)=>n+v*v,0)/signal.length),tailPeak:signal.slice(Math.floor(rate*.3)).reduce((n,v)=>Math.max(n,Math.abs(v)),0)});
        await audio.dispose();
      }
      return rows;
    });
    if(traffic.length)throw new Error('Unexpected production API request blocked: '+traffic.length);
    mkdirSync(dir+'overlap/'+engine,{recursive:true});
    for(const {signal,...row} of rows) {
      if(!row.finite||row.peak>=.8||row.tailPeak>=.00001||row.rms<=.0001)throw new Error(JSON.stringify({engine,...row}));
      writeFileSync(`${dir}overlap/${engine}/${row.rate}-${row.kind}-${row.requestedAt}.wav`,wav(signal,row.rate));
      summary.push({engine,...row});
    }
    await context.close();
  }finally{await browser.close();}
}
const result={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceTree:execFileSync('git',['rev-parse','HEAD:src'],{encoding:'utf8'}).trim(),
  method:'Native OfflineAudioContext suspend/resume at quantized render times; 8 previous voices + 8 new strokes, production graph at final volume1; no page.clock',
  recordedAt:new Date().toISOString(),maximumPeak:Math.max(...summary.map(r=>r.peak)),cases:summary};
writeFileSync(dir+'overlap-measurements.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({sha:result.sha,cases:summary.length,maximumPeak:result.maximumPeak}));
