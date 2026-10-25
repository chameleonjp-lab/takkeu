# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: rally-effects.spec.ts >> moving background/electricity/rings: time sequences, deterministic restore and reduced motion
- Location: tests/browser/rally-effects.spec.ts:90:1

# Error details

```
Error: page.screenshot: Test ended.
Call log:
  - taking page screenshot
  - waiting for fonts to load...
  - fonts loaded

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
  12  | // A/B performs five full-resolution screenshots instead of one per state,
  13  | // including both qualities. Its infrastructure budget is separate from all
  14  | // unchanged pixel/state assertions and the independent frame-time targets.
  15  | const captureBudget=(ordinary:number)=>ordinary*(process.env.RALLY_SINGLE_PASS_AB==='1'?4:1);
  16  | const singlePassRows=new Map<string,object[]>();
  17  | /** Exact full camera/UI pixel comparison, opt-in so routine CI stays compact. */
  18  | async function cameraScreenshot(page:Page,info:TestInfo,path:string){
  19  |   if(process.env.RALLY_SINGLE_PASS_AB!=='1'){await page.screenshot({path});return;}
  20  |   const directory=resolve('docs/verification/rally-4000/diagnostics/single-pass',info.project.name);
  21  |   mkdirSync(directory,{recursive:true});
  22  |   const key=info.title.replace(/[^a-z0-9]+/gi,'-').toLowerCase();
  23  |   const records=singlePassRows.get(info.testId)??[];singlePassRows.set(info.testId,records);
  24  |   const before=await page.evaluate(()=>({snapshot:window.rally.snapshot(),state:window.rally.state()}));
> 25  |   for(const quality of ['standard','low'] as const){
      |                             ^ Error: page.screenshot: Test ended.
  26  |     const control=await page.evaluate(quality=>window.rally.singlePass(false,quality),quality);
  27  |     const oldPNG=await page.screenshot(),oldPixels=pngPixels(oldPNG);
  28  |     const optimized=await page.evaluate(quality=>window.rally.singlePass(true,quality),quality);
  29  |     const newPNG=await page.screenshot(),newPixels=pngPixels(newPNG);
  30  |     const oldHash=createHash('sha256').update(oldPixels.pixels).digest('hex'),newHash=createHash('sha256').update(newPixels.pixels).digest('hex');
  31  |     let changedPixels=0,maxChannelDelta=0;
  32  |     if(oldPixels.width!==newPixels.width||oldPixels.height!==newPixels.height||oldPixels.channels!==newPixels.channels)throw new Error('Single-pass PNG dimensions differ');
  33  |     for(let pixel=0;pixel<oldPixels.width*oldPixels.height;pixel++){
  34  |       let changed=false;
  35  |       for(let channel=0;channel<oldPixels.channels;channel++){
  36  |         const index=pixel*oldPixels.channels+channel,delta=Math.abs(oldPixels.pixels[index]!-newPixels.pixels[index]!);
  37  |         if(delta)changed=true;maxChannelDelta=Math.max(maxChannelDelta,delta);
  38  |       }
  39  |       if(changed)changedPixels++;
  40  |     }
  41  |     const filename=`${key}-${records.length.toString().padStart(3,'0')}-${quality}.png`;
  42  |     writeFileSync(resolve(directory,filename),newPNG);
  43  |     records.push({sourceScreenshot:path,quality,control,optimized,width:newPixels.width,height:newPixels.height,channels:newPixels.channels,
  44  |       controlPixelSHA256:oldHash,optimizedPixelSHA256:newHash,changedPixels,maxChannelDelta,optimizedScreenshot:filename,
  45  |       runId:before.snapshot.runId,score:before.snapshot.score,time:before.snapshot.simTime,phase:before.snapshot.phase});
  46  |     writeFileSync(resolve(directory,`${key}.json`),JSON.stringify(records,null,2));
  47  |     if(changedPixels){writeFileSync(resolve(directory,filename.replace('.png','-control.png')),oldPNG);}
  48  |     expect(changedPixels,`exact old/new pixels for ${path} ${quality}`).toBe(0);
  49  |     expect(optimized.resources.drawCalls).toBeLessThanOrEqual(control.resources.drawCalls);
  50  |     expect(await page.evaluate(()=>({snapshot:window.rally.snapshot(),state:window.rally.state()}))).toEqual(before);
  51  |   }
  52  |   await page.evaluate(()=>window.rally.singlePass(null,'standard'));
  53  |   await page.screenshot({path});
  54  | }
  55  | test.use({viewport:{width:390,height:844},video:'off'});
  56  | test.beforeEach(async({page})=>{
  57  |   // A visual fixture has no reason to leave localhost, even for a known RPC.
  58  |   await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  59  |   // Freeze each loaded module graph while other independent tasks edit source.
  60  |   await page.routeWebSocket('**/*',socket=>socket.close());
  61  |   await page.goto('/tests/fixtures/rally.html');
  62  |   await page.waitForFunction(()=>!!window.rally);
  63  | });
  64  | 
  65  | test('all 23 thresholds: preserve before/arrival/during/after camera evidence and fixed resources',async({page},info)=>{
  66  |   test.setTimeout(captureBudget(240_000));
  67  |   const directory=resolve(evidenceRoot,info.project.name,'thresholds');mkdirSync(directory,{recursive:true});
  68  |   const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  69  |   const rows:object[]=[];
  70  |   for(const threshold of thresholds){
  71  |     await page.evaluate(score=>window.rally.reset(score-1),threshold);
  72  |     for(const [phase,offset] of [['before',0],['arrival',.02],['during',threshold===50?.15:.65],['after',5.2]] as const){
  73  |       if(phase==='arrival')await page.evaluate(score=>window.rally.arrive(score),threshold);
  74  |       if(phase!=='before')await page.evaluate(offset=>window.rally.time(20+offset),offset);
  75  |       const record=await page.evaluate(()=>({snapshot:window.rally.snapshot(),state:window.rally.state(),stats:window.rally.stats(),resources:window.rally.resources(),geometry:window.rally.geometry(),
  76  |         gameplayPositions:window.rally.snapshot().balls.map(ball=>({ballId:ball.id,...window.rally.project(ball.position)})),
  77  |         scrollWidth:document.documentElement.scrollWidth,width:innerWidth,notice:document.querySelector('[data-rally-notice]')?.textContent}));
  78  |       expect(record.snapshot.score).toBe(phase==='before'?threshold-1:threshold);
  79  |       expect(record.gameplayPositions.every(p=>p.inView),'representative foreground balls stay inside camera').toBe(true);
  80  |       expect(record.scrollWidth).toBeLessThanOrEqual(record.width);
  81  |       expect(record.stats.tableQuads+record.stats.worldQuads).toBeLessThanOrEqual(record.stats.capacity);
  82  |       expect(record.stats.geometries).toBe(4);expect(record.stats.materials).toBe(4);
  83  |       if([1000,2000,3000,4000].includes(threshold)&&phase==='during')expect(record.notice).toBe(`${threshold} RALLY`);
  84  |       const filename=`${threshold}-${phase}.png`;
  85  |       await cameraScreenshot(page,info,resolve(directory,filename));
  86  |       rows.push({threshold,phase,offset,screenshot:filename,...record});
  87  |     }
  88  |   }
  89  |   writeFileSync(resolve(directory,'frames.json'),JSON.stringify(rows,null,2));
  90  |   await info.attach('all-threshold-camera-metadata',{body:JSON.stringify(rows),contentType:'application/json'});
  91  |   expect(errors).toEqual([]);
  92  | });
  93  | 
  94  | test('moving background/electricity/rings: time sequences, deterministic restore and reduced motion',async({page},info)=>{
  95  |   test.setTimeout(captureBudget(180_000));
  96  |   const directory=resolve(evidenceRoot,info.project.name,'motion');mkdirSync(directory,{recursive:true});
  97  |   const rows:object[]=[];
  98  |   for(const score of [500,700,1000,1250,1500,1750,2000,2250,2500,2750,3000,3250,3500,3750,4000]){
  99  |     await page.evaluate(score=>window.rally.show(score),score);
  100 |     const shapes:unknown[]=[];
  101 |     for(const offset of (score===4000?[.1,.35,.8,1.4,2.5,3.5]:[.1,.35,.8,1.4])){
  102 |       await page.evaluate(offset=>window.rally.time(20+offset),offset);
  103 |       const geometry=await page.evaluate(()=>window.rally.geometry());shapes.push(geometry);
  104 |       await cameraScreenshot(page,info,resolve(directory,`${score}-${offset.toFixed(2)}.png`));
  105 |       rows.push({score,offset,geometry,stats:await page.evaluate(()=>window.rally.stats())});
  106 |     }
  107 |     expect(JSON.stringify(shapes[0]),`${score} geometry changes over simulation time`).not.toBe(JSON.stringify(shapes[2]));
  108 |   }
  109 |   await page.evaluate(()=>{window.rally.show(4000,20.7);window.rally.pause();});
  110 |   const paused=await page.evaluate(()=>({state:window.rally.state(),snapshot:window.rally.snapshot(),geometry:window.rally.geometry()}));
  111 |   await page.evaluate(()=>{window.rally.advance(10);window.rally.redraw();window.rally.replayHit();window.rally.restore();});
  112 |   expect(await page.evaluate(()=>({state:window.rally.state(),snapshot:window.rally.snapshot(),geometry:window.rally.geometry()}))).toEqual(paused);
  113 |   await page.emulateMedia({reducedMotion:'reduce'});
  114 |   await page.evaluate(()=>{window.rally.resume();window.rally.reset(4001);window.rally.time(26);});
  115 |   const reduced=await page.evaluate(()=>window.rally.geometry());
  116 |   await page.evaluate(()=>window.rally.time(27));
  117 |   expect(await page.evaluate(()=>window.rally.geometry())).toEqual(reduced);
  118 |   await cameraScreenshot(page,info,resolve(directory,'4001-reduced-motion.png'));
  119 |   writeFileSync(resolve(directory,'geometry-sequence.json'),JSON.stringify(rows,null,2));
  120 |   await info.attach('target-geometry-sequences',{body:JSON.stringify(rows),contentType:'application/json'});
  121 | });
  122 | 
  123 | test('losses keep actual distinct positions, number lifetimes and final drawing without advancing balls',async({page},info)=>{
  124 |   test.setTimeout(captureBudget(180_000));
  125 |   const directory=resolve(evidenceRoot,info.project.name,'losses');mkdirSync(directory,{recursive:true});
```