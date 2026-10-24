import { expect, test } from '../helpers/browserTest';
import type {} from '../helpers/appHarness';

// Continuous video/trace canvas readbacks dominate this software-rendered load
// at 774+ balls. Keep all 30 game seconds, state/resource checks and the final
// screenshot, just as quality.spec.ts does for its functional load checks.
test.use({ video: 'off', trace: 'off' });

test('555の774球から毎ラリー加速・全スマッシュ・増球を30ゲーム秒継続する',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  // Exercise the production catch-up loop at 10Hz while preserving every
  // 120Hz physics step. Native realtime FPS is measured separately; rendering
  // 774+ balls at a forced 60Hz on SwiftShader is not a device performance test.
  test.setTimeout(360_000);await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.goto('/tests/fixtures/stage3.html');await page.getByRole('button',{name:'はじめる',exact:true}).click();
  await page.evaluate(()=>{window.stage3.show(555);window.stage3.autoPlay(true);});
  const rows=[];
  for(let i=0;i<30;i++){for(let frame=0;frame<10;frame++)await page.clock.fastForward(100);rows.push(await page.evaluate(()=>({score:window.stage3.snapshot().score,balls:window.stage3.snapshot().balls.length,phase:window.stage3.snapshot().phase,resources:window.stage3.resources()})));}
  const state=await page.evaluate(()=>window.stage3.snapshot()),events=await page.evaluate(()=>window.stage3.metrics().events);
  expect(state.simTime).toBeGreaterThanOrEqual(29.9);expect(state.simTime).toBeLessThanOrEqual(30.1);
  expect(state.phase).toBe('running');expect(state.score).toBeGreaterThan(600);expect(state.balls.length).toBe(279 + (state.score - 390) * 3);
  expect(events.filter(e=>e.kind==='opponent-hit').length).toBeGreaterThan(40);
  expect(await page.evaluate(()=>window.stage3.metrics().smashDepartures)).toBe(events.filter(e=>e.kind==='opponent-hit').length);
  expect(rows.every(row=>row.resources!.particles<=1536)).toBe(true);
  expect(rows.every(row=>row.resources!.drawCalls<45)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({path:info.outputPath('555-multiball.png')});
  await info.attach('extended-highload.json',{body:JSON.stringify({rows,final:state,eventCount:events.length},null,2),contentType:'application/json'});
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'ホームへ',exact:true}).click();
  expect(await page.evaluate(()=>window.stage3.resources()!.particles)).toBe(0);
});
