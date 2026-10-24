import { expect, test } from '../helpers/browserTest';
import type {} from '../helpers/stageHarness';
import type {} from '../helpers/appHarness';

test.use({video:'on'});
test('460〜555の追加段階を表示し、相手側の継ぎ目とランダムな動きを保存する',async({page},info)=>{
  test.setTimeout(120_000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto('/tests/fixtures/stage2.html');await page.waitForFunction(()=>!!window.stage2);
  const scores=[459,460,469,470,471,472,479,480,489,490,499,500,509,510,519,520,529,530,539,540,554,555];
  for(const score of scores){
    await page.evaluate(score=>window.stage2.show(score),score);
    const state=await page.evaluate(()=>({s:window.stage2.snapshot(),p:window.stage2.presentation()}));
    expect(state.s.balls.length).toBe(score<470?2+Math.floor(score/10):49+Math.floor((score-470)/2));
    expect(state.p.parts.structure.rainbow).toBe(score>=460);
    expect(state.p.opponentField).toBe(score>=490);expect(state.p.opponentRandom).toBe(score>=500);expect(state.p.ownRandom).toBe(score>=510);
    expect(state.p.balls[2]!.visible).toBe(score>=480);
    if(score>=490){expect(state.p.parts.opponentBody.visible).toBe(false);expect(state.p.opponentEdgesVisible).toBe(false);}
    await page.screenshot({path:info.outputPath(`extended-${score}.png`)});
  }
  for(const score of [490,500,510]){
    await page.evaluate(score=>window.stage2.show(score),score);
    const before=await page.locator('canvas').screenshot();await page.evaluate(()=>window.stage2.time(.85));
    expect(before.equals(await page.locator('canvas').screenshot())).toBe(false);
    await page.evaluate(score=>window.stage2.show(score),score);await page.evaluate(()=>window.stage2.animate(1.8));
  }
  expect(errors).toEqual([]);
});

test('返球・台面の花火を実際の接触イベントで描き、停止・リトライで過去の粒子を残さない',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/tests/fixtures/stage2.html');await page.waitForFunction(()=>!!window.stage2);
  await page.evaluate(()=>{window.stage2.beginFireworks(530);window.stage2.advance(.04);});
  expect(await page.evaluate(()=>window.stage2.events().some(e=>e.effect==='bounce-firework'))).toBe(true);
  expect(await page.evaluate(()=>window.stage2.resources().particles)).toBeGreaterThan(0);
  await page.screenshot({path:info.outputPath('bounce-firework.png')});
  await page.evaluate(()=>window.stage2.animate(.28));
  expect(await page.evaluate(()=>window.stage2.events().some(e=>e.effect==='racket-firework'))).toBe(true);
  await page.screenshot({path:info.outputPath('racket-firework.png')});
  await page.keyboard.press('Escape');
  const before=await page.locator('canvas').screenshot(), resources=await page.evaluate(()=>window.stage2.resources());
  await page.evaluate(()=>window.stage2.advance(2));
  expect(before.equals(await page.locator('canvas').screenshot())).toBe(true);
  expect(await page.evaluate(()=>window.stage2.resources())).toEqual(resources);
  await page.getByRole('button',{name:'つづける',exact:true}).click();await page.evaluate(()=>window.stage2.animate(.8));
  expect(await page.evaluate(()=>window.stage2.resources().particles)).toBe(0);
  const recorded=await page.evaluate(()=>window.stage2.events());
  await page.evaluate(()=>window.stage2.show(0));expect(await page.evaluate(()=>window.stage2.resources().particles)).toBe(0);
  await info.attach('firework-events.json',{body:JSON.stringify(recorded,null,2),contentType:'application/json'});
  expect(errors).toEqual([]);
});

test('555の91球から毎ラリー加速・全スマッシュ・増球を30ゲーム秒継続する',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  // A full-viewport CI run completed 30 game seconds and final assertions but
  // exceeded 240s after long screenshot/teardown waits. Preserve all frames and
  // assertions with 360s locally and in CI; real-time performance is separate.
  test.setTimeout(360_000);await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.goto('/tests/fixtures/stage3.html');await page.getByRole('button',{name:'はじめる',exact:true}).click();
  await page.evaluate(()=>{window.stage3.show(555);window.stage3.autoPlay(true);});
  const rows=[];
  for(let i=0;i<30;i++){await page.clock.runFor(1000);rows.push(await page.evaluate(()=>({score:window.stage3.snapshot().score,balls:window.stage3.snapshot().balls.length,phase:window.stage3.snapshot().phase,resources:window.stage3.resources()})));}
  const state=await page.evaluate(()=>window.stage3.snapshot()),events=await page.evaluate(()=>window.stage3.metrics().events);
  expect(state.phase).toBe('running');expect(state.score).toBeGreaterThan(600);expect(state.balls.length).toBe(49+Math.floor((state.score-470)/2));
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

test('実アプリのホーム遷移で花火を直ちに消し、再挑戦へ持ち越さない',async({page})=>{
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.goto('/tests/fixtures/stage3.html');await page.getByRole('button',{name:'はじめる',exact:true}).click();
  await page.evaluate(()=>{window.stage3.show(555);window.stage3.autoPlay(true);});await page.clock.runFor(1000);
  expect(await page.evaluate(()=>window.stage3.resources()!.particles)).toBeGreaterThan(0);
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'ホームへ',exact:true}).click();expect(await page.evaluate(()=>window.stage3.resources()!.particles)).toBe(0);
  await page.getByRole('button',{name:'はじめる',exact:true}).click();await page.clock.runFor(32);
  expect(await page.evaluate(()=>window.stage3.resources()!.particles)).toBe(0);
});
