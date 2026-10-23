# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: extended.spec.ts >> 555の91球から毎ラリー加速・全スマッシュ・増球を30ゲーム秒継続する
- Location: tests/browser/extended.spec.ts:54:1

# Error details

```
Error: page.evaluate: Execution context was destroyed, most likely because of a navigation
```

# Page snapshot

```yaml
- main [ref=f1e3]:
  - generic [ref=f1e4]:
    - generic [ref=f1e5]:
      - generic [aria-hidden] [ref=f1e6]: t.
      - generic [ref=f1e7]: TAKKEU
      - generic [ref=f1e8]: 卓球の、その先へ。
    - generic [ref=f1e10]:
      - paragraph [ref=f1e11]: ONE BALL. ENDLESS RALLY.
      - heading "タッケウ" [level=1] [ref=f1e13]: タッケウ.
      - paragraph [ref=f1e14]: ワンバウンドをとらえて、ラリーをつなぐ。
      - paragraph [ref=f1e15]: 指をすべらせて、ラケットを球に合わせる。自分の台で一度弾んだ球に触れれば、打ち返せます。
      - button "はじめる" [active] [ref=f1e16] [cursor=pointer]:
        - text: はじめる
        - generic [aria-hidden] [ref=f1e17]: ↗
      - paragraph [ref=f1e18]: スマホはスワイプ・PCはドラッグ
    - generic "遊び方" [ref=f1e20]:
      - generic [ref=f1e21]:
        - generic [ref=f1e22]: "01"
        - paragraph [ref=f1e23]:
          - strong [ref=f1e24]: 指を置く
          - generic [ref=f1e25]: 画面の好きな場所から。
      - generic [ref=f1e26]:
        - generic [ref=f1e27]: "02"
        - paragraph [ref=f1e28]:
          - strong [ref=f1e29]: 動かす
          - generic [ref=f1e30]: 左右・上下へスワイプ。
      - generic [ref=f1e31]:
        - generic [ref=f1e32]: "03"
        - paragraph [ref=f1e33]:
          - strong [ref=f1e34]: つなぐ
          - generic [ref=f1e35]: 自分の返球で +1 ラリー。
    - generic [ref=f1e36]:
      - paragraph [ref=f1e37]:
        - text: 自己ベスト
        - status "自己ベスト" [ref=f1e38]: "0"
        - text: ラリー
      - button "設定" [ref=f1e39] [cursor=pointer]
  - status [ref=f1e40]: ホーム
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | import type {} from '../helpers/stageHarness';
  3  | import type {} from '../helpers/appHarness';
  4  | 
  5  | test.use({video:'on'});
  6  | test('460〜555の追加段階を表示し、相手側の継ぎ目とランダムな動きを保存する',async({page},info)=>{
  7  |   test.setTimeout(120_000);
  8  |   const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  9  |   page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  10 |   await page.goto('/tests/fixtures/stage2.html');await page.waitForFunction(()=>!!window.stage2);
  11 |   const scores=[459,460,469,470,471,472,479,480,489,490,499,500,509,510,519,520,529,530,539,540,554,555];
  12 |   for(const score of scores){
  13 |     await page.evaluate(score=>window.stage2.show(score),score);
  14 |     const state=await page.evaluate(()=>({s:window.stage2.snapshot(),p:window.stage2.presentation()}));
  15 |     expect(state.s.balls.length).toBe(score<470?2+Math.floor(score/10):49+Math.floor((score-470)/2));
  16 |     expect(state.p.parts.structure.rainbow).toBe(score>=460);
  17 |     expect(state.p.opponentField).toBe(score>=490);expect(state.p.opponentRandom).toBe(score>=500);expect(state.p.ownRandom).toBe(score>=510);
  18 |     expect(state.p.balls[2]!.visible).toBe(score>=480);
  19 |     if(score>=490){expect(state.p.parts.opponentBody.visible).toBe(false);expect(state.p.opponentEdgesVisible).toBe(false);}
  20 |     await page.screenshot({path:info.outputPath(`extended-${score}.png`)});
  21 |   }
  22 |   for(const score of [490,500,510]){
  23 |     await page.evaluate(score=>window.stage2.show(score),score);
  24 |     const before=await page.locator('canvas').screenshot();await page.evaluate(()=>window.stage2.time(.85));
  25 |     expect(before.equals(await page.locator('canvas').screenshot())).toBe(false);
  26 |     await page.evaluate(score=>window.stage2.show(score),score);await page.evaluate(()=>window.stage2.animate(1.8));
  27 |   }
  28 |   expect(errors).toEqual([]);
  29 | });
  30 | 
  31 | test('返球・台面の花火を実際の接触イベントで描き、停止・リトライで過去の粒子を残さない',async({page},info)=>{
  32 |   const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  33 |   await page.goto('/tests/fixtures/stage2.html');await page.waitForFunction(()=>!!window.stage2);
  34 |   await page.evaluate(()=>{window.stage2.beginFireworks(530);window.stage2.advance(.04);});
  35 |   expect(await page.evaluate(()=>window.stage2.events().some(e=>e.effect==='bounce-firework'))).toBe(true);
  36 |   expect(await page.evaluate(()=>window.stage2.resources().particles)).toBeGreaterThan(0);
  37 |   await page.screenshot({path:info.outputPath('bounce-firework.png')});
  38 |   await page.evaluate(()=>window.stage2.animate(.28));
  39 |   expect(await page.evaluate(()=>window.stage2.events().some(e=>e.effect==='racket-firework'))).toBe(true);
  40 |   await page.screenshot({path:info.outputPath('racket-firework.png')});
  41 |   await page.getByRole('button',{name:'一時停止',exact:true}).click();
  42 |   const before=await page.locator('canvas').screenshot(), resources=await page.evaluate(()=>window.stage2.resources());
  43 |   await page.evaluate(()=>window.stage2.advance(2));
  44 |   expect(before.equals(await page.locator('canvas').screenshot())).toBe(true);
  45 |   expect(await page.evaluate(()=>window.stage2.resources())).toEqual(resources);
  46 |   await page.getByRole('button',{name:'つづける',exact:true}).click();await page.evaluate(()=>window.stage2.animate(.8));
  47 |   expect(await page.evaluate(()=>window.stage2.resources().particles)).toBe(0);
  48 |   const recorded=await page.evaluate(()=>window.stage2.events());
  49 |   await page.evaluate(()=>window.stage2.show(0));expect(await page.evaluate(()=>window.stage2.resources().particles)).toBe(0);
  50 |   await info.attach('firework-events.json',{body:JSON.stringify(recorded,null,2),contentType:'application/json'});
  51 |   expect(errors).toEqual([]);
  52 | });
  53 | 
  54 | test('555の91球から毎ラリー加速・全スマッシュ・増球を30ゲーム秒継続する',async({page},info)=>{
  55 |   const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  56 |   page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  57 |   // Includes software GPU readback/video teardown; this is a 30-game-second
  58 |   // functional test. Real-time performance uses the separate performance suite.
  59 |   test.setTimeout(240_000);await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
  60 |   await page.goto('/tests/fixtures/stage3.html');await page.getByRole('button',{name:'はじめる',exact:true}).click();
  61 |   await page.evaluate(()=>{window.stage3.show(555);window.stage3.autoPlay(true);});
  62 |   const rows=[];
> 63 |   for(let i=0;i<30;i++){await page.clock.runFor(1000);rows.push(await page.evaluate(()=>({score:window.stage3.snapshot().score,balls:window.stage3.snapshot().balls.length,phase:window.stage3.snapshot().phase,resources:window.stage3.resources()})));}
     |                                                                            ^ Error: page.evaluate: Execution context was destroyed, most likely because of a navigation
  64 |   const state=await page.evaluate(()=>window.stage3.snapshot()),events=await page.evaluate(()=>window.stage3.metrics().events);
  65 |   expect(state.phase).toBe('running');expect(state.score).toBeGreaterThan(600);expect(state.balls.length).toBe(49+Math.floor((state.score-470)/2));
  66 |   expect(events.filter(e=>e.kind==='opponent-hit').length).toBeGreaterThan(40);
  67 |   expect(await page.evaluate(()=>window.stage3.metrics().smashDepartures)).toBe(events.filter(e=>e.kind==='opponent-hit').length);
  68 |   expect(rows.every(row=>row.resources!.particles<=1536)).toBe(true);
  69 |   expect(rows.every(row=>row.resources!.drawCalls<45)).toBe(true);
  70 |   expect(errors).toEqual([]);
  71 |   await page.screenshot({path:info.outputPath('555-multiball.png')});
  72 |   await info.attach('extended-highload.json',{body:JSON.stringify({rows,final:state,eventCount:events.length},null,2),contentType:'application/json'});
  73 |   await page.getByRole('link',{name:'タッケウ'}).click();
  74 |   expect(await page.evaluate(()=>window.stage3.resources()!.particles)).toBe(0);
  75 | });
  76 | 
  77 | test('実アプリのホーム遷移で花火を直ちに消し、再挑戦へ持ち越さない',async({page})=>{
  78 |   await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
  79 |   await page.goto('/tests/fixtures/stage3.html');await page.getByRole('button',{name:'はじめる',exact:true}).click();
  80 |   await page.evaluate(()=>{window.stage3.show(555);window.stage3.autoPlay(true);});await page.clock.runFor(1000);
  81 |   expect(await page.evaluate(()=>window.stage3.resources()!.particles)).toBeGreaterThan(0);
  82 |   await page.getByRole('link',{name:'タッケウ'}).click();expect(await page.evaluate(()=>window.stage3.resources()!.particles)).toBe(0);
  83 |   await page.getByRole('button',{name:'はじめる',exact:true}).click();await page.clock.runFor(32);
  84 |   expect(await page.evaluate(()=>window.stage3.resources()!.particles)).toBe(0);
  85 | });
  86 | 
```