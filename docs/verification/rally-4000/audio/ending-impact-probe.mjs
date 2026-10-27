import { chromium, webkit } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)),rows=[];
const wav=(signal,rate)=>{const out=Buffer.alloc(44+signal.length*2);out.write('RIFF');out.writeUInt32LE(out.length-8,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(1,22);out.writeUInt32LE(rate,24);out.writeUInt32LE(rate*2,28);out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(signal.length*2,40);signal.forEach((v,i)=>out.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767),44+i*2));return out;};
for(const [engine,browserType] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await browserType.launch({headless:true,args:engine==='chromium'?['--no-sandbox']:[]});
 try{
  const page=await browser.newPage();await page.route('**/@vite/client',route=>route.fulfill({body:'',contentType:'text/javascript'}));await page.goto(`${process.env.AUDIO_PROBE_URL??'http://127.0.0.1:4181'}/tests/fixtures/audio-fanfare.html`);
  const renders=await page.evaluate(async()=>{
   const {createAudio}=await import('/src/audio/audio.ts'),{DEFAULT_CONFIG}=await import('/src/game/config.ts');const renders=[];
   for(const ending of [false,true]){
    const rate=48000,ctx=new OfflineAudioContext(1,rate/2,rate),live=new Set();
    const facade=new Proxy(ctx,{get(target,key){if(key==='state')return 'running';if(['resume','suspend','close'].includes(key))return async()=>{};const value=Reflect.get(target,key,target);if(typeof value!=='function')return value;if(String(key).startsWith('create')&&key!=='createBuffer')return(...args)=>{const node=value.apply(target,args);live.add(node);const disconnect=node.disconnect.bind(node);node.disconnect=()=>{live.delete(node);disconnect();};return node;};return value.bind(target);},set(target,key,value){return Reflect.set(target,key,value,target);}});
    const audio=createAudio(DEFAULT_CONFIG,()=>facade);audio.reset('ending');if(!await audio.unlock())throw Error('unlock');
    if(ending)audio.consume([{kind:'player-hit',id:'last-hit',runId:'ending',time:2,ballId:1,rallyScore:99}]);
    audio.consumeAchievement({kind:'loss-impact',id:'loss-100',runId:'ending',time:2});
    if(ending)audio.consume([{kind:'ball-lost',id:'loss-100',runId:'ending',time:2,ballId:1},{kind:'game-over',id:'end',runId:'ending',time:2}]);
    const signal=Array.from((await ctx.startRendering()).getChannelData(0)),peak=Math.max(...signal.map(Math.abs)),rms=Math.sqrt(signal.slice(0,11520).reduce((sum,value)=>sum+value*value,0)/11520),silence=Math.max(...signal.slice(12000).map(Math.abs));
    const liveAfterRender=live.size;await audio.dispose();renders.push({ending,rate,signal,peak,rms,silence,liveAfterRender,liveAfterDispose:live.size});
   }return renders;
  });
  const [control,ending]=renders;const difference=Math.max(...ending.signal.map((value,i)=>Math.abs(value-control.signal[i])));
  if(ending.rms<.0001||ending.peak>=.8||ending.silence>.00001||ending.liveAfterDispose!==0||difference>.000001)throw Error(`final impact failed ${JSON.stringify({...ending,signal:undefined,difference})}`);
  await writeFile(`${root}/audio/${engine}-ending-impact.wav`,wav(ending.signal,ending.rate));rows.push({engine,control:{...control,signal:undefined},ending:{...ending,signal:undefined},difference});
 }finally{await browser.close();}
}
await writeFile(`${root}/audio/ending-impact-summary.json`,JSON.stringify(rows,null,2));console.log(JSON.stringify(rows,null,2));
