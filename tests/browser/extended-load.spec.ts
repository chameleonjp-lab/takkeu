import { expect, test, waitForStart } from '../helpers/browserTest';
import type {} from '../helpers/appHarness';

// Keep all 30 game seconds, state/resource checks and the final screenshot.
// Continuous video/trace canvas readbacks are covered by other browser suites.
test.use({ video: 'off', trace: 'off' });

test('555の30球から同時返球・失球・増球・全スマッシュを30ゲーム秒継続する',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  // Exercise the production catch-up loop at 10Hz while preserving every
  // 120Hz physics step. Native realtime FPS is measured separately.
  test.setTimeout(360_000);await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.goto('/tests/fixtures/stage3.html');await page.getByRole('button',{name:'はじめる',exact:true}).click();
  await waitForStart(page);
  await page.evaluate(()=>{window.stage3.show(555);window.stage3.autoPlay(false);});
  expect(await page.evaluate(()=>window.stage3.snapshot().balls.length)).toBe(30);
  for(let frame=0;frame<5;frame++)await page.clock.fastForward(100);
  const opening=await page.evaluate(()=>({state:window.stage3.snapshot(),events:window.stage3.metrics().events}));
  const firstServes=opening.events.filter(e=>e.kind==='opponent-hit');
  expect(firstServes.map(e=>e.ballId).sort((a,b)=>a!-b!)).toEqual(Array.from({length:30},(_,i)=>i+1));
  expect(new Set(firstServes.map(e=>e.time)).size).toBe(1);
  expect(firstServes.every(e=>e.time<=0.5)).toBe(true);
  expect(opening.state.balls.filter(b=>b.phase==='incoming'||b.phase==='outgoing')).toHaveLength(30);
  const rows=[];
  const addedIds=new Set<number>();
  for(let i=0;i<30;i++){
    for(let frame=0;frame<(i===0?5:10);frame++)await page.clock.fastForward(100);
    const row=await page.evaluate(()=>({state:window.stage3.snapshot(),events:window.stage3.metrics().events,resources:window.stage3.resources()}));
    for(const ball of row.state.balls)if(ball.id>30)addedIds.add(ball.id);
    for(const event of row.events)if(event.ballId!==undefined&&event.ballId>30)addedIds.add(event.ballId);
    const losses=row.events.filter(e=>e.kind==='ball-lost').length;
    expect(row.state.phase).toBe('running');
    expect(row.state.balls.length).toBeLessThanOrEqual(30);
    expect(row.state.balls).toHaveLength(30+addedIds.size-losses);
    rows.push({score:row.state.score,balls:row.state.balls.length,losses,additions:addedIds.size,resources:row.resources});
    // The center paddle catches part of the opening wave; resume tracking after real misses.
    if(i===1)await page.evaluate(()=>window.stage3.autoPlay(true));
  }
  const state=await page.evaluate(()=>window.stage3.snapshot()),events=await page.evaluate(()=>window.stage3.metrics().events);
  expect(state.simTime).toBeGreaterThanOrEqual(29.9);expect(state.simTime).toBeLessThanOrEqual(30.1);
  expect(state.phase).toBe('running');expect(state.score).toBeGreaterThan(600);expect(state.balls.length).toBeLessThanOrEqual(30);
  expect(events.filter(e=>e.kind==='player-hit')).toHaveLength(state.score-555);
  expect(events.filter(e=>e.kind==='ball-lost').length).toBeGreaterThan(0);
  expect(addedIds.size).toBeGreaterThan(0);
  expect(events.some(e=>e.kind==='smash-warning')).toBe(true);
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
