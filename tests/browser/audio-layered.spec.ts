import { writeFile } from 'node:fs/promises';
import type { TestInfo } from '@playwright/test';
import { expect, test } from '../helpers/browserTest';
import { wav } from '../helpers/wav';
import { installAudioProbe } from '../helpers/audioProbe';

async function persist(info: TestInfo, name: string, data: { body: Buffer | string; contentType: string }) {
  const path=info.outputPath(name); await writeFile(path,data.body);
  await info.attach(name,{path,contentType:data.contentType});
}

test('多層音と最終出力を44.1/48kHzで合成、単発と上限+減衰の波形を保存', async ({ page }, info) => {
  await page.goto('/');
  const rows = await page.evaluate(async () => {
    const audioUrl='/src/audio/audio.ts', toneUrl='/src/audio/tones.ts', oldUrl='/tests/helpers/legacyTones.ts', configUrl='/src/game/config.ts';
    const { createAudio }=await import(/* @vite-ignore */ audioUrl);
    const tones=await import(/* @vite-ignore */ toneUrl), legacy=await import(/* @vite-ignore */ oldUrl);
    const { DEFAULT_CONFIG }=await import(/* @vite-ignore */ configUrl);
    const rows=[];
    for(const rate of [44100,48000]) for(const mode of ['player1','player4','player5','player9','player10','success10','opponent','warning','sixteen','quiet','muted','zero','fallback','old-player','old-opponent','old-warning','old-sixteen']) {
      const ctx=new OfflineAudioContext(1,rate/2,rate);
      // Real offline graph, with only realtime lifecycle methods adapted. All
      // synthesis, compressor and final user volume use production createAudio.
      const facade=new Proxy(ctx, { get(target,key) {
        if(key==='state') return 'running';
        if(key==='resume'||key==='suspend'||key==='close') return async()=>{};
        if(mode==='fallback' && key==='createWaveShaper') return undefined;
        const value=Reflect.get(target,key,target); return typeof value==='function' ? value.bind(target) : value;
      }, set(target,key,value) { return Reflect.set(target,key,value,target); } });
      if(mode.startsWith('old-')) {
        const out=ctx.createGain(); out.gain.value=.65*.85/(16*.16); out.connect(ctx.destination);
        if(mode==='old-sixteen') for(let i=0;i<16;i++) (i%3===0?legacy.playSmashWarning:i%2===0?legacy.playPlayerHit:legacy.playOpponentHit)(ctx,out);
        else (mode==='old-player'?legacy.playPlayerHit:mode==='old-opponent'?legacy.playOpponentHit:legacy.playSmashWarning)(ctx,out);
      } else {
        const audio=createAudio(DEFAULT_CONFIG,()=>facade); audio.reset('offline');
        if(!await audio.unlock()) throw new Error('Offline lifecycle adaptation failed');
        audio.setVolume(mode==='quiet' ? .2 : mode==='zero' ? 0 : mode==='sixteen' ? 1 : .65);
        let next=0;
        const emit=(kind:string,score=10,smashReturn=false)=>audio.consume([{ kind, id:String(++next), runId:'offline', time:0, ballId:next, rallyScore:score, smashReturn }]);
        if(mode==='opponent') emit('opponent-hit');
        else if(mode==='warning') emit('smash-warning');
        else if(mode==='sixteen') for(let i=0;i<16;i++) emit(i%3===0?'smash-warning':i%2===0?'player-hit':'opponent-hit',100,true);
        else emit('player-hit',mode.startsWith('player') ? Number(mode.slice(6)) : 10,mode==='success10');
        if(mode==='muted') audio.setMuted(true);
      }
      const signal=Array.from((await ctx.startRendering()).getChannelData(0));
      const peak=signal.reduce((n,v)=>Math.max(n,Math.abs(v)),0), rms=Math.sqrt(signal.reduce((n,v)=>n+v*v,0)/signal.length);
      rows.push({ rate, mode, signal, peak, rms, finite:signal.every(Number.isFinite),
        tailPeak:signal.slice(Math.floor(rate*.3)).reduce((n,v)=>Math.max(n,Math.abs(v)),0) });
    }
    // Direct full-quality sources must exercise shaper + 10-source success path
    // independently of the dynamic voice-pressure reduction in createAudio.
    const ctx=new OfflineAudioContext(1,24000,48000), out=ctx.createGain();out.gain.value=.65*.8/(16*.16);out.connect(ctx.destination);
    const voices=Array.from({length:16},()=>tones.playSmashSuccess(ctx,out,undefined,{score:100}));
    const signal=Array.from((await ctx.startRendering()).getChannelData(0));
    rows.push({rate:48000,mode:'full-quality-sixteen',sourceCounts:voices.map(v=>v.sourceCount),signal,
      peak:signal.reduce((n,v)=>Math.max(n,Math.abs(v)),0),rms:Math.sqrt(signal.reduce((n,v)=>n+v*v,0)/signal.length),finite:signal.every(Number.isFinite),
      tailPeak:signal.slice(14400).reduce((n,v)=>Math.max(n,Math.abs(v)),0)});
    return rows;
  });
  for(const row of rows) {
    expect(row.finite).toBe(true); expect(row.peak).toBeLessThan(.8); expect(row.tailPeak).toBeLessThan(.00001);
    if(row.mode==='muted'||row.mode==='zero') expect(row.peak).toBe(0);
    else expect(row.rms).toBeGreaterThan(.0001);
    if(row.mode==='full-quality-sixteen') expect(row.sourceCounts).toEqual(Array(16).fill(10));
    await persist(info,`${row.rate}-${row.mode}.wav`,{body:wav(row.signal,row.rate),contentType:'audio/wav'});
    if(['player1','opponent','warning','sixteen','old-player','old-opponent','old-warning','old-sixteen'].includes(row.mode)) {
      // Same RMS across full half-second files, preserving spectral/transient
      // differences for listening; never count a louder sample as better.
      await persist(info,`${row.rate}-${row.mode}-rms-matched.wav`,{body:wav(row.signal.map(v=>v*.025/row.rms),row.rate),contentType:'audio/wav'});
    }
  }
  const at=(mode:string)=>rows.find(r=>r.rate===48000&&r.mode===mode)!;
  expect(at('quiet').rms/at('player10').rms).toBeCloseTo(.2/.65,3);
  await persist(info,'waveform-measurements.json',{body:JSON.stringify(rows.map(({signal:_,...row})=>row),null,2),contentType:'application/json'});
});

test('実AudioContextで多球・停止・復旧・run切替と部分失敗を繰り返し、予約音とnodeを回収', async({page},info)=>{
  await page.addInitScript(installAudioProbe);
  await page.goto('/'); await page.getByRole('button',{name:'はじめる',exact:true}).click();
  await page.keyboard.press('Escape');
  const metrics=await page.evaluate(async()=>{
    const audioUrl='/src/audio/audio.ts', configUrl='/src/game/config.ts';
    const {createAudio}=await import(/* @vite-ignore */ audioUrl),{DEFAULT_CONFIG}=await import(/* @vite-ignore */ configUrl);
    const ctx=new AudioContext(),audio=createAudio(DEFAULT_CONFIG,()=>ctx);
    const baseline=window.audioResources(),cycles=[];
    for(let run=0;run<20;run++) {
      audio.reset(String(run)); if(!await audio.unlock())throw new Error('native unlock failed');
      const events=Array.from({length:91},(_,i)=>({kind:i%3===0?'smash-warning':'player-hit',runId:String(run),id:String(i),time:i/1000,ballId:i,rallyScore:555+i,smashReturn:true}));
      audio.consume(events); const burst=window.audioResources();
      audio.setMuted(true); const muted=window.audioResources(); audio.setMuted(false);
      audio.consume(events); const duplicate=window.audioResources();
      audio.suspend();cycles.push({burst,muted,duplicate,stopped:window.audioResources()});
    }
    const create=ctx.createOscillator.bind(ctx); let calls=0;
    ctx.createOscillator=()=>{if(++calls===3)throw new Error('injected third source failure');return create();};
    audio.reset('fault'); await audio.unlock(); audio.consume([{kind:'player-hit',id:'fault',runId:'fault',time:0,ballId:1,rallyScore:10,smashReturn:true}]);
    const failed=window.audioResources(); ctx.createOscillator=create;
    await audio.unlock(); audio.consume([{kind:'player-hit',id:'recovered',runId:'fault',time:1,ballId:1,rallyScore:11,smashReturn:true}]);
    // Real audio clock lets delayed sources naturally start/end and dispatch
    // onended callbacks, independent of requestAnimationFrame/game-clock tests.
    await new Promise(resolve=>setTimeout(resolve,300)); const ended=window.audioResources();
    await audio.dispose(); return {baseline,cycles,failed,ended,disposed:window.audioResources(),state:ctx.state};
  });
  const base=metrics.baseline;
  for(const row of metrics.cycles) {
    expect(row.burst.layeredVoices-base.layeredVoices).toBeLessThanOrEqual(16);
    expect(row.burst.liveSources-base.liveSources).toBeLessThanOrEqual(160);
    expect(row.muted.liveSources).toBe(base.liveSources); expect(row.muted.layeredVoices).toBe(base.layeredVoices);
    expect(row.duplicate.sourceCreated).toBe(row.muted.sourceCreated);
    expect(row.stopped.liveNodes).toBe(base.liveNodes+2); // master compressor + user volume only
  }
  expect(metrics.failed.liveSources).toBe(base.liveSources); expect(metrics.ended.liveSources).toBe(base.liveSources);
  expect(metrics.disposed.liveNodes).toBe(base.liveNodes); expect(metrics.state).toBe('closed');
  await persist(info,'native-audio-resources.json',{body:JSON.stringify(metrics,null,2),contentType:'application/json'});
});
