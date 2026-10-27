# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: rally-effects.spec.ts >> all 23 thresholds: preserve before/arrival/during/after camera evidence and fixed resources
- Location: tests/browser/rally-effects.spec.ts:61:1

# Error details

```
Test timeout of 240000ms exceeded.
```

```
Error: page.evaluate: Test timeout of 240000ms exceeded.
```

# Page snapshot

```yaml
- main [ref=e1]:
  - generic [ref=e2]:
    - generic "卓球ゲームの描画領域" [active] [ref=e5]
    - generic:
      - generic:
        - generic: RALLY
        - status "ラリー数": "4000"
      - generic:
        - generic: 残球数
        - status "残球数": "2"
      - generic:
        - generic: 落球数
        - status "落球数": 0 / 100
      - paragraph [aria-hidden]:
        - generic: 4000 RALLY
      - status: 4000 RALLY
    - generic:
      - generic:
        - status: プレイ中。残球数2。
```

# Test source

```ts
  1   | import { mkdirSync, writeFileSync } from 'node:fs';
  2   | import { resolve } from 'node:path';
  3   | import { createHash } from 'node:crypto';
  4   | import type { TestInfo } from '@playwright/test';
  5   | import { expect, test } from '../helpers/browserTest';
  6   | import type { Page } from '../helpers/browserTest';
  7   | import type {} from '../helpers/rallyHarness';
  8   | import { goldContribution, pngPixels } from '../helpers/pngPixels';
  9   | 
  10  | const thresholds=[50,100,200,300,400,500,600,700,800,900,1000,1250,1500,1750,2000,2250,2500,2750,3000,3250,3500,3750,4000];
  11  | const evidenceRoot=resolve('docs/verification/rally-4000/evidence');
  12  | const singlePassRows=new Map<string,object[]>();
  13  | /** Exact full camera/UI pixel comparison, opt-in so routine CI stays compact. */
  14  | async function cameraScreenshot(page:Page,info:TestInfo,path:string){
  15  |   if(process.env.RALLY_SINGLE_PASS_AB!=='1'){await page.screenshot({path});return;}
  16  |   const directory=resolve('docs/verification/rally-4000/diagnostics/single-pass',info.project.name);
  17  |   mkdirSync(directory,{recursive:true});
  18  |   const key=info.title.replace(/[^a-z0-9]+/gi,'-').toLowerCase();
  19  |   const records=singlePassRows.get(info.testId)??[];singlePassRows.set(info.testId,records);
  20  |   const before=await page.evaluate(()=>({snapshot:window.rally.snapshot(),state:window.rally.state()}));
  21  |   for(const quality of ['standard','low'] as const){
  22  |     const control=await page.evaluate(quality=>window.rally.singlePass(false,quality),quality);
  23  |     const oldPNG=await page.screenshot(),oldPixels=pngPixels(oldPNG);
> 24  |     const optimized=await page.evaluate(quality=>window.rally.singlePass(true,quality),quality);
      |                                ^ Error: page.evaluate: Test timeout of 240000ms exceeded.
  25  |     const newPNG=await page.screenshot(),newPixels=pngPixels(newPNG);
  26  |     const oldHash=createHash('sha256').update(oldPixels.pixels).digest('hex'),newHash=createHash('sha256').update(newPixels.pixels).digest('hex');
  27  |     let changedPixels=0,maxChannelDelta=0;
  28  |     if(oldPixels.width!==newPixels.width||oldPixels.height!==newPixels.height||oldPixels.channels!==newPixels.channels)throw new Error('Single-pass PNG dimensions differ');
  29  |     for(let pixel=0;pixel<oldPixels.width*oldPixels.height;pixel++){
  30  |       let changed=false;
  31  |       for(let channel=0;channel<oldPixels.channels;channel++){
  32  |         const index=pixel*oldPixels.channels+channel,delta=Math.abs(oldPixels.pixels[index]!-newPixels.pixels[index]!);
  33  |         if(delta)changed=true;maxChannelDelta=Math.max(maxChannelDelta,delta);
  34  |       }
  35  |       if(changed)changedPixels++;
  36  |     }
  37  |     const filename=`${key}-${records.length.toString().padStart(3,'0')}-${quality}.png`;
  38  |     writeFileSync(resolve(directory,filename),newPNG);
  39  |     records.push({sourceScreenshot:path,quality,control,optimized,width:newPixels.width,height:newPixels.height,channels:newPixels.channels,
  40  |       controlPixelSHA256:oldHash,optimizedPixelSHA256:newHash,changedPixels,maxChannelDelta,optimizedScreenshot:filename,
  41  |       runId:before.snapshot.runId,score:before.snapshot.score,time:before.snapshot.simTime,phase:before.snapshot.phase});
  42  |     writeFileSync(resolve(directory,`${key}.json`),JSON.stringify(records,null,2));
  43  |     if(changedPixels){writeFileSync(resolve(directory,filename.replace('.png','-control.png')),oldPNG);}
  44  |     expect(changedPixels,`exact old/new pixels for ${path} ${quality}`).toBe(0);
  45  |     expect(optimized.resources.drawCalls).toBeLessThanOrEqual(control.resources.drawCalls);
  46  |     expect(await page.evaluate(()=>({snapshot:window.rally.snapshot(),state:window.rally.state()}))).toEqual(before);
  47  |   }
  48  |   await page.evaluate(()=>window.rally.singlePass(null,'standard'));
  49  |   await page.screenshot({path});
  50  | }
  51  | test.use({viewport:{width:390,height:844},video:'off'});
  52  | test.beforeEach(async({page})=>{
  53  |   // A visual fixture has no reason to leave localhost, even for a known RPC.
  54  |   await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  55  |   // Freeze each loaded module graph while other independent tasks edit source.
  56  |   await page.routeWebSocket('**/*',socket=>socket.close());
  57  |   await page.goto('/tests/fixtures/rally.html');
  58  |   await page.waitForFunction(()=>!!window.rally);
  59  | });
  60  | 
  61  | test('all 23 thresholds: preserve before/arrival/during/after camera evidence and fixed resources',async({page},info)=>{
  62  |   test.setTimeout(240_000);
  63  |   const directory=resolve(evidenceRoot,info.project.name,'thresholds');mkdirSync(directory,{recursive:true});
  64  |   const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  65  |   const rows:object[]=[];
  66  |   for(const threshold of thresholds){
  67  |     await page.evaluate(score=>window.rally.reset(score-1),threshold);
  68  |     for(const [phase,offset] of [['before',0],['arrival',.02],['during',threshold===50?.15:.65],['after',5.2]] as const){
  69  |       if(phase==='arrival')await page.evaluate(score=>window.rally.arrive(score),threshold);
  70  |       if(phase!=='before')await page.evaluate(offset=>window.rally.time(20+offset),offset);
  71  |       const record=await page.evaluate(()=>({snapshot:window.rally.snapshot(),state:window.rally.state(),stats:window.rally.stats(),resources:window.rally.resources(),geometry:window.rally.geometry(),
  72  |         gameplayPositions:window.rally.snapshot().balls.map(ball=>({ballId:ball.id,...window.rally.project(ball.position)})),
  73  |         scrollWidth:document.documentElement.scrollWidth,width:innerWidth,notice:document.querySelector('[data-rally-notice]')?.textContent}));
  74  |       expect(record.snapshot.score).toBe(phase==='before'?threshold-1:threshold);
  75  |       expect(record.gameplayPositions.every(p=>p.inView),'representative foreground balls stay inside camera').toBe(true);
  76  |       expect(record.scrollWidth).toBeLessThanOrEqual(record.width);
  77  |       expect(record.stats.tableQuads+record.stats.worldQuads).toBeLessThanOrEqual(record.stats.capacity);
  78  |       expect(record.stats.geometries).toBe(4);expect(record.stats.materials).toBe(4);
  79  |       if([1000,2000,3000,4000].includes(threshold)&&phase==='during')expect(record.notice).toBe(`${threshold} RALLY`);
  80  |       const filename=`${threshold}-${phase}.png`;
  81  |       await cameraScreenshot(page,info,resolve(directory,filename));
  82  |       rows.push({threshold,phase,offset,screenshot:filename,...record});
  83  |     }
  84  |   }
  85  |   writeFileSync(resolve(directory,'frames.json'),JSON.stringify(rows,null,2));
  86  |   await info.attach('all-threshold-camera-metadata',{body:JSON.stringify(rows),contentType:'application/json'});
  87  |   expect(errors).toEqual([]);
  88  | });
  89  | 
  90  | test('moving background/electricity/rings: time sequences, deterministic restore and reduced motion',async({page},info)=>{
  91  |   test.setTimeout(180_000);
  92  |   const directory=resolve(evidenceRoot,info.project.name,'motion');mkdirSync(directory,{recursive:true});
  93  |   const rows:object[]=[];
  94  |   for(const score of [500,700,1000,1250,1500,1750,2000,2250,2500,2750,3000,3250,3500,3750,4000]){
  95  |     await page.evaluate(score=>window.rally.show(score),score);
  96  |     const shapes:unknown[]=[];
  97  |     for(const offset of (score===4000?[.1,.35,.8,1.4,2.5,3.5]:[.1,.35,.8,1.4])){
  98  |       await page.evaluate(offset=>window.rally.time(20+offset),offset);
  99  |       const geometry=await page.evaluate(()=>window.rally.geometry());shapes.push(geometry);
  100 |       await cameraScreenshot(page,info,resolve(directory,`${score}-${offset.toFixed(2)}.png`));
  101 |       rows.push({score,offset,geometry,stats:await page.evaluate(()=>window.rally.stats())});
  102 |     }
  103 |     expect(JSON.stringify(shapes[0]),`${score} geometry changes over simulation time`).not.toBe(JSON.stringify(shapes[2]));
  104 |   }
  105 |   await page.evaluate(()=>{window.rally.show(4000,20.7);window.rally.pause();});
  106 |   const paused=await page.evaluate(()=>({state:window.rally.state(),snapshot:window.rally.snapshot(),geometry:window.rally.geometry()}));
  107 |   await page.evaluate(()=>{window.rally.advance(10);window.rally.redraw();window.rally.replayHit();window.rally.restore();});
  108 |   expect(await page.evaluate(()=>({state:window.rally.state(),snapshot:window.rally.snapshot(),geometry:window.rally.geometry()}))).toEqual(paused);
  109 |   await page.emulateMedia({reducedMotion:'reduce'});
  110 |   await page.evaluate(()=>{window.rally.resume();window.rally.reset(4001);window.rally.time(26);});
  111 |   const reduced=await page.evaluate(()=>window.rally.geometry());
  112 |   await page.evaluate(()=>window.rally.time(27));
  113 |   expect(await page.evaluate(()=>window.rally.geometry())).toEqual(reduced);
  114 |   await cameraScreenshot(page,info,resolve(directory,'4001-reduced-motion.png'));
  115 |   writeFileSync(resolve(directory,'geometry-sequence.json'),JSON.stringify(rows,null,2));
  116 |   await info.attach('target-geometry-sequences',{body:JSON.stringify(rows),contentType:'application/json'});
  117 | });
  118 | 
  119 | test('losses keep actual distinct positions, number lifetimes and final drawing without advancing balls',async({page},info)=>{
  120 |   test.setTimeout(180_000);
  121 |   const directory=resolve(evidenceRoot,info.project.name,'losses');mkdirSync(directory,{recursive:true});
  122 |   const rows:object[]=[];
  123 |   for(const count of [1,4,10,20,30,40,50,55,77,88,90,99,100]){
  124 |     await page.evaluate(count=>window.rally.loss(count,count===4||count===100?4:1,count===4),count);
```