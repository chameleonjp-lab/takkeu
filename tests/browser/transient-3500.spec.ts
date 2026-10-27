import {expect,test,waitForStart} from '../helpers/browserTest';
import type {} from '../helpers/appHarness';
async function boot(page:import('@playwright/test').Page){
 await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));await page.goto('/tests/fixtures/stage3.html');
 await page.getByRole('button',{name:'はじめる',exact:true}).click();await waitForStart(page);
}
test('3000 is a pass-through and3500 displays electricity while physics and simTime remain frozen',async({page},info)=>{
 await boot(page);await page.evaluate(()=>{window.stage3.goal(2999,2);window.stage3.autoPlay(true);});await page.clock.runFor(200);
 expect(await page.evaluate(()=>window.stage3.snapshot())).toMatchObject({score:3001,phase:'running',endReason:null});
 await expect(page.locator('[data-rally-notice]')).toContainText('3000 RALLY');await expect(page.locator('[data-result]')).toBeHidden();
 await page.evaluate(()=>window.stage3.goal());await page.clock.runFor(200);
 const first=await page.evaluate(()=>({s:window.stage3.snapshot(),n:window.stage3.metrics().viewRenders,stats:window.stage3.resources()?.rallyEffects}));
 expect(first.s).toMatchObject({score:3500,phase:'gameover',endReason:'clear'});expect(first.stats?.activeEffects).toContain('clear-electric');await expect(page.locator('[data-result]')).toBeHidden();
 await page.clock.runFor(500);expect(await page.evaluate(()=>window.stage3.snapshot())).toEqual(first.s);expect(await page.evaluate(()=>window.stage3.metrics().viewRenders)).toBeGreaterThan(first.n);
 await page.screenshot({path:info.outputPath('clear-electric-before-result.png')});
 await page.clock.runFor(3000);await expect(page.locator('[data-result]')).toBeVisible();expect(await page.evaluate(()=>window.stage3.resources()?.rallyEffects?.activeEffects)).toEqual([]);
 const n=await page.evaluate(()=>window.stage3.metrics().viewRenders);await page.clock.runFor(3000);expect(await page.evaluate(()=>window.stage3.metrics().viewRenders)).toBe(n);expect(await page.evaluate(()=>window.stage3.snapshot())).toEqual(first.s);
});
for(const interrupt of ['hidden','restore','retry'] as const)test(`finish cannot revive after ${interrupt}, including reduced motion`,async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await boot(page);await page.evaluate(()=>window.stage3.goal());await page.clock.runFor(200);
 expect(await page.evaluate(()=>window.stage3.resources()?.rallyEffects?.activeEffects)).toContain('clear-electric');
 if(interrupt==='restore')await page.evaluate(()=>{const c=document.querySelector('canvas')!;c.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));c.dispatchEvent(new Event('webglcontextrestored'));});
 else if(interrupt==='hidden'){
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await page.clock.runFor(32);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
 }else await page.clock.runFor(3000);
 await page.clock.runFor(32);
 await expect(page.locator('[data-result]')).toBeVisible();
 if(interrupt==='retry'){await page.getByRole('button',{name:'もう一度',exact:true}).click();await waitForStart(page);expect(await page.evaluate(()=>window.stage3.resources()?.rallyEffects?.activeEffects)).not.toContain('clear-electric');}
 else{const n=await page.evaluate(()=>window.stage3.metrics().viewRenders);await page.clock.runFor(4000);expect(await page.evaluate(()=>window.stage3.metrics().viewRenders)).toBe(n);}
});
test('20 interrupted clear/retry cycles reuse GPU resources',async({page},info)=>{
 test.setTimeout(180000);await boot(page);const rows=[];
 for(let i=0;i<20;i++){
  await page.evaluate(()=>window.stage3.goal());await page.clock.runFor(200);
  rows.push(await page.evaluate(()=>window.stage3.resources()));
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await page.clock.runFor(32);
  await page.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,get:()=>false}));
  await page.getByRole('button',{name:'もう一度',exact:true}).click();await waitForStart(page);
 }
 const keys=['geometries','textures','programs']as const;
 for(const key of keys)expect(new Set(rows.map(r=>r?.[key])).size).toBe(1);
 await info.attach('20-retry-resources',{body:JSON.stringify(rows),contentType:'application/json'});
});
for(const interrupt of ['hidden','restore']as const)test(`running milestones expire on direct ${interrupt} without changing simulation facts`,async({page})=>{
 await boot(page);await page.evaluate(()=>{window.stage3.goal(1999,1);window.stage3.autoPlay(true);});await page.clock.runFor(200);
 expect(await page.evaluate(()=>window.stage3.resources()?.rallyEffects?.activeEffects)).toContain('rally-electric');
 if(interrupt==='hidden')await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 else await page.evaluate(()=>document.querySelector('canvas')!.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));
 const frozen=await page.evaluate(()=>window.stage3.snapshot());await page.clock.runFor(10000);expect(await page.evaluate(()=>window.stage3.snapshot())).toEqual(frozen);
 if(interrupt==='hidden')await page.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,get:()=>false}));else{await page.evaluate(()=>window.stage3.restore());await page.clock.runFor(32);}
 await page.getByRole('button',{name:'つづける',exact:true}).click();await page.clock.runFor(32);expect(await page.evaluate(()=>window.stage3.resources()?.rallyEffects?.activeEffects)).not.toContain('rally-electric');
});
test('100th loss wins over99, shows its short ending and then stops3D rendering',async({page})=>{
 await boot(page);await page.evaluate(()=>window.stage3.lossLimit(98));await page.clock.runFor(200);
 const frozen=await page.evaluate(()=>window.stage3.snapshot());expect(frozen).toMatchObject({phase:'gameover',endReason:'loss',lostBallCount:100});await expect(page.locator('[data-result]')).toBeHidden();
 await page.clock.runFor(2200);await expect(page.locator('[data-result]')).toBeVisible();const n=await page.evaluate(()=>window.stage3.metrics().viewRenders);await page.clock.runFor(2000);expect(await page.evaluate(()=>window.stage3.metrics().viewRenders)).toBe(n);expect(await page.evaluate(()=>window.stage3.snapshot())).toEqual(frozen);expect(await page.evaluate(()=>window.stage3.resources()?.rallyEffects?.activeEffects)).toEqual([]);
});
