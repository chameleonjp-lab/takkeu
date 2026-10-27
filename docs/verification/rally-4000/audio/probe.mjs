import { chromium, webkit } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
const root=fileURLToPath(new URL('..',import.meta.url));
await mkdir(`${root}/audio`,{recursive:true});
function wav(signal,rate){const out=Buffer.alloc(44+signal.length*2);out.write('RIFF');out.writeUInt32LE(out.length-8,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(1,22);out.writeUInt32LE(rate,24);out.writeUInt32LE(rate*2,28);out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(signal.length*2,40);signal.forEach((v,i)=>out.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767),44+i*2));return out;}
const reports=[];
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true,args:name==='chromium'?['--no-sandbox']:[]});
 console.log(`starting ${name}`);const page=await browser.newPage();page.on('console', message=>console.log(message.text()));page.setDefaultTimeout(60000);await page.goto(`${process.env.AUDIO_PROBE_URL??'http://127.0.0.1:4181'}/tests/fixtures/audio-fanfare.html`);
 const rows=await page.evaluate(async()=>{
  const {createAudio}=await import('/src/audio/audio.ts'),{DEFAULT_CONFIG}=await import('/src/game/config.ts');const rows=[];
  const modes=['standard','low','quiet','muted','zero','fallback','warning','saturated-warning','saturated-no-warning','saturated-duck-only','warning-only','best-record','loss-impact'];
  for(const rate of [44100,48000])for(const score of [1000,3000,4000])for(const mode of modes){
   if(['best-record','loss-impact'].includes(mode)&&score!==1000)continue;console.log(`render ${rate} ${score} ${mode}`);
   const ctx=new OfflineAudioContext(1,Math.ceil(rate*3.4),rate),live=new Set(),voices=new Set();let peakVoices=0;
   const facade=new Proxy(ctx,{get(target,key){if(key==='state')return 'running';if(['resume','suspend','close'].includes(key))return async()=>{};if(mode==='fallback'&&key==='createWaveShaper')return undefined;const v=Reflect.get(target,key,target);if(typeof v!=='function')return v;if(String(key).startsWith('create')&&key!=='createBuffer')return (...args)=>{const node=v.apply(target,args);if(mode==='saturated-duck-only'&&target.currentTime>.4&&['createOscillator','createBufferSource'].includes(key))node.connect=()=>{};live.add(node);if(key==='createWaveShaper'){voices.add(node);peakVoices=Math.max(peakVoices,voices.size);}const native=node.disconnect.bind(node);node.disconnect=()=>{live.delete(node);voices.delete(node);native();};return node;};return v.bind(target);},set(target,key,value){return Reflect.set(target,key,value,target);}});
   const audio=createAudio(DEFAULT_CONFIG,()=>facade);audio.reset('probe');if(!await audio.unlock())throw Error('offline unlock');audio.setQuality(mode==='low'?'low':'standard');audio.setVolume(mode==='quiet'?.2:mode==='zero'?0:.65);if(mode==='muted')audio.setMuted(true);
   if(['best-record','loss-impact'].includes(mode))audio.consumeAchievement({kind:mode,id:mode,runId:'probe',time:0});
   else if(mode!=='warning-only')audio.consume([{kind:'player-hit',id:String(score),runId:'probe',time:0,rallyScore:score,ballId:1}]);
   if(mode.startsWith('saturated'))for(let i=1;i<8;i++)audio.consume([{kind:'player-hit',id:`fill-${i}`,runId:'probe',time:0,rallyScore:score+i*100,ballId:i+1}]);
   const hasWarning=['warning','saturated-warning','saturated-duck-only','warning-only'].includes(mode);
   let signal;
   if(hasWarning){const pause=ctx.suspend(.45),render=ctx.startRendering();await Promise.race([pause,new Promise((_,reject)=>setTimeout(()=>reject(Error('offline suspend timeout')),10000))]);audio.consume([{kind:'smash-warning',id:'warning',runId:'probe',time:.45,ballId:1}]);await ctx.resume();signal=Array.from((await render).getChannelData(0));}
   else signal=Array.from((await ctx.startRendering()).getChannelData(0));
   const peak=signal.reduce((p,v)=>Math.max(p,Math.abs(v)),0);const rms=(a,b)=>{const part=signal.slice(Math.floor(a*rate),Math.floor(b*rate));return Math.sqrt(part.reduce((sum,v)=>sum+v*v,0)/part.length);};
   // A warning is spectrally distinct from the low brass/bell voices. The band
   // estimate is its first-difference high frequency energy, used with paired
   // no-warning render rather than claiming a perceptual listening verdict.
   const diff=(a,b)=>{let sum=0,n=0;for(let i=Math.floor(a*rate)+1;i<Math.floor(b*rate);i++){sum+=(signal[i]-signal[i-1])**2;n++;}return Math.sqrt(sum/n);};
   const liveAtEnd=live.size;await audio.dispose();rows.push({rate,score,mode,peak,finite:signal.every(Number.isFinite),rms:rms(0,3.2),warningWindowRms:rms(.46,.60),warningDifferenceRms:diff(.46,.60),recoverRms:rms(.9,1.05),tailRms:rms(2,2.15),peakVoices,liveAtEnd,liveAfterDispose:live.size,signal});
  }for(const row of rows.filter(row=>row.mode==='saturated-warning')){const control=rows.find(other=>other.mode==='saturated-duck-only'&&other.rate===row.rate&&other.score===row.score);const from=Math.floor(.46*row.rate),to=Math.floor(.60*row.rate);let sum=0;for(let i=from;i<to;i++)sum+=(row.signal[i]-control.signal[i])**2;row.warningResidualRms=Math.sqrt(sum/(to-from));}return rows.map(row=>({...row,signal:row.rate===48000&&['standard','warning','saturated-warning','best-record','loss-impact'].includes(row.mode)?row.signal:[]}));
 });
 for(const row of rows){if(!row.finite||row.peak>=.8||row.peakVoices>16||row.liveAfterDispose!==0)throw Error(`${name} bad bounded render ${JSON.stringify({...row,signal:undefined})}`);if(row.mode==='saturated-warning'&&row.warningResidualRms<.001)throw Error('warning residual lost at saturation');if(['muted','zero'].includes(row.mode)&&row.peak!==0)throw Error('silent mode audible');if(row.rate===48000&&['standard','warning','saturated-warning','best-record','loss-impact'].includes(row.mode))await writeFile(`${root}/audio/${name}-${row.score}-${row.mode}.wav`,wav(row.signal,row.rate));}
 const measurements=rows.map(({signal,...rest})=>rest);await writeFile(`${root}/audio/${name}-measurements.json`,JSON.stringify(measurements,null,2));
 reports.push({engine:name,renders:rows.length,maxPeak:Math.max(...rows.map(r=>r.peak)),maxVoicesIncludingFading:Math.max(...rows.map(r=>r.peakVoices)),allDisposed:rows.every(r=>r.liveAfterDispose===0),warningPairs:rows.filter(r=>r.mode==='saturated-warning').map(r=>{const a=rows.find(a=>a.rate===r.rate&&a.score===r.score&&a.mode==='saturated-no-warning');return {rate:r.rate,score:r.score,warningResidualRms:r.warningResidualRms,warningRms:r.warningWindowRms,withoutWarningRms:a.warningWindowRms,warningDifference:r.warningDifferenceRms,withoutWarningDifference:a.warningDifferenceRms};})});
 await browser.close();
}
await writeFile(`${root}/audio/summary.json`,JSON.stringify(reports,null,2));console.log(JSON.stringify(reports,null,2));
