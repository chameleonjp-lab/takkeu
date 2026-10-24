# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: audio-layered.spec.ts >> 多層音と最終出力を44.1/48kHzで合成、単発と上限+減衰の波形を保存
- Location: tests/browser/audio-layered.spec.ts:5:1

# Error details

```
Error: page.evaluate: Error: Offline lifecycle adaptation failed
```

# Page snapshot

```yaml
- main [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - generic [aria-hidden] [ref=e6]: t.
      - generic [ref=e7]: TAKKEU
      - generic [ref=e8]: 卓球の、その先へ。
    - generic [ref=e10]:
      - paragraph [ref=e11]: ONE BALL. ENDLESS RALLY.
      - heading "タッケウ" [level=1] [ref=e13]: タッケウ.
      - paragraph [ref=e14]: ワンバウンドをとらえて、ラリーをつなぐ。
      - paragraph [ref=e15]: タップした位置にラケットを置き、ドラッグで球に合わせる。自分の台で一度弾んだ球に触れれば、打ち返せます。
      - generic [ref=e16]:
        - generic [ref=e17]: ランキングの名前 任意
        - textbox "ランキングの名前 任意" [ref=e18]:
          - /placeholder: 名前なしでも遊べます
        - paragraph [ref=e19]: 20文字以内。入力すると名前と記録が公開され、カメレオンの実験場のランキングに参加します。同じ名前の記録は合算されます。名前なしのプレイも回数だけ記録します。
      - button "はじめる" [active] [ref=e20] [cursor=pointer]:
        - text: はじめる
        - generic [aria-hidden] [ref=e21]: ↗
      - paragraph [ref=e22]: 2本指で短くタップ、またはEscキーで一時停止
    - generic "遊び方" [ref=e23]:
      - generic [ref=e24]:
        - generic [ref=e25]: "01"
        - paragraph [ref=e26]:
          - strong [ref=e27]: タップで置く
          - generic [ref=e28]: 指やポインターの位置へ直接移動。
      - generic [ref=e29]:
        - generic [ref=e30]: "02"
        - paragraph [ref=e31]:
          - strong [ref=e32]: ドラッグで動かす
          - generic [ref=e33]: 押している間は、その位置について動きます。
      - generic [ref=e34]:
        - generic [ref=e35]: "03"
        - paragraph [ref=e36]:
          - strong [ref=e37]: 離すと止まる
          - generic [ref=e38]: 最後の位置を保ち、自分の返球で +1。
    - generic [ref=e39]:
      - paragraph [ref=e40]:
        - text: 自己ベスト
        - status "自己ベスト" [ref=e41]: "0"
        - text: ラリー
      - link "Xでシェア" [ref=e42]:
        - /url: https://twitter.com/intent/tweet?text=%E3%82%BF%E3%83%83%E3%83%97%EF%BC%86%E3%83%89%E3%83%A9%E3%83%83%E3%82%B0%E3%81%A7%E9%81%8A%E3%81%B9%E3%82%8B%E5%8D%93%E7%90%83%E3%82%B2%E3%83%BC%E3%83%A0%E3%80%8C%E3%82%BF%E3%83%83%E3%82%B1%E3%82%A6%E3%80%8D%EF%BC%81%0A%E4%BD%95%E3%83%A9%E3%83%AA%E3%83%BC%E3%81%A4%E3%81%AA%E3%81%92%E3%82%89%E3%82%8C%E3%82%8B%EF%BC%9F+%23%E3%82%BF%E3%83%83%E3%82%B1%E3%82%A6&url=https%3A%2F%2Fchameleonjp-lab.github.io%2Ftakkeu%2F
      - link "カメレオンの実験場" [ref=e43]:
        - /url: https://chameleonjp-lab.github.io/chameleonjp_lab/
      - button "設定" [ref=e44] [cursor=pointer]
    - status [ref=e45]: ホーム
```

# Test source

```ts
  1   | import { expect, test } from '../helpers/browserTest';
  2   | import { wav } from '../helpers/wav';
  3   | import { installAudioProbe } from '../helpers/audioProbe';
  4   | 
  5   | test('多層音と最終出力を44.1/48kHzで合成、単発と上限+減衰の波形を保存', async ({ page }, info) => {
  6   |   await page.goto('/');
> 7   |   const rows = await page.evaluate(async () => {
      |                           ^ Error: page.evaluate: Error: Offline lifecycle adaptation failed
  8   |     const audioUrl='/src/audio/audio.ts', toneUrl='/src/audio/tones.ts', oldUrl='/tests/helpers/legacyTones.ts', configUrl='/src/game/config.ts';
  9   |     const { createAudio }=await import(/* @vite-ignore */ audioUrl);
  10  |     const tones=await import(/* @vite-ignore */ toneUrl), legacy=await import(/* @vite-ignore */ oldUrl);
  11  |     const { DEFAULT_CONFIG }=await import(/* @vite-ignore */ configUrl);
  12  |     const rows=[];
  13  |     for(const rate of [44100,48000]) for(const mode of ['player1','player4','player5','player9','player10','success10','opponent','warning','sixteen','quiet','muted','zero','fallback','old-player','old-opponent','old-warning','old-sixteen']) {
  14  |       const ctx=new OfflineAudioContext(1,rate/2,rate);
  15  |       // Real offline graph, with only realtime lifecycle methods adapted. All
  16  |       // synthesis, compressor and final user volume use production createAudio.
  17  |       const facade=new Proxy(ctx, { get(target,key) {
  18  |         if(key==='state') return 'running';
  19  |         if(key==='resume'||key==='suspend'||key==='close') return async()=>{};
  20  |         if(mode==='fallback' && key==='createWaveShaper') return undefined;
  21  |         const value=Reflect.get(target,key,target); return typeof value==='function' ? value.bind(target) : value;
  22  |       } });
  23  |       if(mode.startsWith('old-')) {
  24  |         const out=ctx.createGain(); out.gain.value=.65*.85/(16*.16); out.connect(ctx.destination);
  25  |         if(mode==='old-sixteen') for(let i=0;i<16;i++) (i%3===0?legacy.playSmashWarning:i%2===0?legacy.playPlayerHit:legacy.playOpponentHit)(ctx,out);
  26  |         else (mode==='old-player'?legacy.playPlayerHit:mode==='old-opponent'?legacy.playOpponentHit:legacy.playSmashWarning)(ctx,out);
  27  |       } else {
  28  |         const audio=createAudio(DEFAULT_CONFIG,()=>facade); audio.reset('offline');
  29  |         if(!await audio.unlock()) throw new Error('Offline lifecycle adaptation failed');
  30  |         audio.setVolume(mode==='quiet' ? .2 : mode==='zero' ? 0 : mode==='sixteen' ? 1 : .65);
  31  |         let next=0;
  32  |         const emit=(kind:string,score=10,smashReturn=false)=>audio.consume([{ kind, id:String(++next), runId:'offline', time:0, ballId:next, rallyScore:score, smashReturn }]);
  33  |         if(mode==='opponent') emit('opponent-hit');
  34  |         else if(mode==='warning') emit('smash-warning');
  35  |         else if(mode==='sixteen') for(let i=0;i<16;i++) emit(i%3===0?'smash-warning':i%2===0?'player-hit':'opponent-hit',100,true);
  36  |         else emit('player-hit',mode.startsWith('player') ? Number(mode.slice(6)) : 10,mode==='success10');
  37  |         if(mode==='muted') audio.setMuted(true);
  38  |       }
  39  |       const signal=Array.from((await ctx.startRendering()).getChannelData(0));
  40  |       const peak=signal.reduce((n,v)=>Math.max(n,Math.abs(v)),0), rms=Math.sqrt(signal.reduce((n,v)=>n+v*v,0)/signal.length);
  41  |       rows.push({ rate, mode, signal, peak, rms, finite:signal.every(Number.isFinite),
  42  |         tailPeak:signal.slice(Math.floor(rate*.3)).reduce((n,v)=>Math.max(n,Math.abs(v)),0) });
  43  |     }
  44  |     // Direct full-quality sources must exercise shaper + 10-source success path
  45  |     // independently of the dynamic voice-pressure reduction in createAudio.
  46  |     const ctx=new OfflineAudioContext(1,24000,48000), out=ctx.createGain();out.gain.value=.65*.8/(16*.16);out.connect(ctx.destination);
  47  |     const voices=Array.from({length:16},()=>tones.playSmashSuccess(ctx,out,undefined,{score:100}));
  48  |     const signal=Array.from((await ctx.startRendering()).getChannelData(0));
  49  |     rows.push({rate:48000,mode:'full-quality-sixteen',sourceCounts:voices.map(v=>v.sourceCount),signal,
  50  |       peak:signal.reduce((n,v)=>Math.max(n,Math.abs(v)),0),rms:Math.sqrt(signal.reduce((n,v)=>n+v*v,0)/signal.length),finite:signal.every(Number.isFinite),
  51  |       tailPeak:signal.slice(14400).reduce((n,v)=>Math.max(n,Math.abs(v)),0)});
  52  |     return rows;
  53  |   });
  54  |   for(const row of rows) {
  55  |     expect(row.finite).toBe(true); expect(row.peak).toBeLessThan(.8); expect(row.tailPeak).toBeLessThan(.00001);
  56  |     if(row.mode==='muted'||row.mode==='zero') expect(row.peak).toBe(0);
  57  |     else expect(row.rms).toBeGreaterThan(.0001);
  58  |     if(row.mode==='full-quality-sixteen') expect(row.sourceCounts).toEqual(Array(16).fill(10));
  59  |     await info.attach(`${row.rate}-${row.mode}.wav`,{body:wav(row.signal,row.rate),contentType:'audio/wav'});
  60  |     if(['player1','opponent','warning','sixteen','old-player','old-opponent','old-warning','old-sixteen'].includes(row.mode)) {
  61  |       // Same RMS across full half-second files, preserving spectral/transient
  62  |       // differences for listening; never count a louder sample as better.
  63  |       await info.attach(`${row.rate}-${row.mode}-rms-matched.wav`,{body:wav(row.signal.map(v=>v*.025/row.rms),row.rate),contentType:'audio/wav'});
  64  |     }
  65  |   }
  66  |   const at=(mode:string)=>rows.find(r=>r.rate===48000&&r.mode===mode)!;
  67  |   expect(at('quiet').rms/at('player10').rms).toBeCloseTo(.2/.65,3);
  68  |   await info.attach('waveform-measurements.json',{body:JSON.stringify(rows.map(({signal:_,...row})=>row),null,2),contentType:'application/json'});
  69  | });
  70  | 
  71  | test('実AudioContextで多球・停止・復旧・run切替と部分失敗を繰り返し、予約音とnodeを回収', async({page},info)=>{
  72  |   await page.addInitScript(installAudioProbe);
  73  |   await page.goto('/'); await page.getByRole('button',{name:'はじめる',exact:true}).click();
  74  |   await page.keyboard.press('Escape');
  75  |   const metrics=await page.evaluate(async()=>{
  76  |     const audioUrl='/src/audio/audio.ts', configUrl='/src/game/config.ts';
  77  |     const {createAudio}=await import(/* @vite-ignore */ audioUrl),{DEFAULT_CONFIG}=await import(/* @vite-ignore */ configUrl);
  78  |     const ctx=new AudioContext(),audio=createAudio(DEFAULT_CONFIG,()=>ctx);
  79  |     const baseline=window.audioResources(),cycles=[];
  80  |     for(let run=0;run<20;run++) {
  81  |       audio.reset(String(run)); if(!await audio.unlock())throw new Error('native unlock failed');
  82  |       const events=Array.from({length:91},(_,i)=>({kind:i%3===0?'smash-warning':'player-hit',runId:String(run),id:String(i),time:i/1000,ballId:i,rallyScore:555+i,smashReturn:true}));
  83  |       audio.consume(events); const burst=window.audioResources();
  84  |       audio.setMuted(true); const muted=window.audioResources(); audio.setMuted(false);
  85  |       audio.consume(events); const duplicate=window.audioResources();
  86  |       audio.suspend();cycles.push({burst,muted,duplicate,stopped:window.audioResources()});
  87  |     }
  88  |     const create=ctx.createOscillator.bind(ctx); let calls=0;
  89  |     ctx.createOscillator=()=>{if(++calls===3)throw new Error('injected third source failure');return create();};
  90  |     audio.reset('fault'); await audio.unlock(); audio.consume([{kind:'player-hit',id:'fault',runId:'fault',time:0,ballId:1,rallyScore:10,smashReturn:true}]);
  91  |     const failed=window.audioResources(); ctx.createOscillator=create;
  92  |     await audio.unlock(); audio.consume([{kind:'player-hit',id:'recovered',runId:'fault',time:1,ballId:1,rallyScore:11,smashReturn:true}]);
  93  |     // Real audio clock lets delayed sources naturally start/end and dispatch
  94  |     // onended callbacks, independent of requestAnimationFrame/game-clock tests.
  95  |     await new Promise(resolve=>setTimeout(resolve,300)); const ended=window.audioResources();
  96  |     await audio.dispose(); return {baseline,cycles,failed,ended,disposed:window.audioResources(),state:ctx.state};
  97  |   });
  98  |   const base=metrics.baseline;
  99  |   for(const row of metrics.cycles) {
  100 |     expect(row.burst.layeredVoices-base.layeredVoices).toBeLessThanOrEqual(16);
  101 |     expect(row.burst.liveSources-base.liveSources).toBeLessThanOrEqual(160);
  102 |     expect(row.muted.liveSources).toBe(base.liveSources); expect(row.muted.layeredVoices).toBe(base.layeredVoices);
  103 |     expect(row.duplicate.sourceCreated).toBe(row.muted.sourceCreated);
  104 |     expect(row.stopped.liveNodes).toBe(base.liveNodes+2); // master compressor + user volume only
  105 |   }
  106 |   expect(metrics.failed.liveSources).toBe(base.liveSources); expect(metrics.ended.liveSources).toBe(base.liveSources);
  107 |   expect(metrics.disposed.liveNodes).toBe(base.liveNodes); expect(metrics.state).toBe('closed');
```