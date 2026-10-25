import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '../helpers/browserTest';
import type {} from '../helpers/rallyHarness';
import { goldContribution } from '../helpers/pngPixels';

const thresholds=[50,100,200,300,400,500,600,700,800,900,1000,1250,1500,1750,2000,2250,2500,2750,3000,3250,3500,3750,4000];
const evidenceRoot=resolve('docs/verification/rally-4000/evidence');
test.use({viewport:{width:390,height:844},video:'off'});
test.beforeEach(async({page})=>{
  // A visual fixture has no reason to leave localhost, even for a known RPC.
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  // Freeze each loaded module graph while other independent tasks edit source.
  await page.routeWebSocket('**/*',socket=>socket.close());
  await page.goto('/tests/fixtures/rally.html');
  await page.waitForFunction(()=>!!window.rally);
});

test('all 23 thresholds: preserve before/arrival/during/after camera evidence and fixed resources',async({page},info)=>{
  test.setTimeout(240_000);
  const directory=resolve(evidenceRoot,info.project.name,'thresholds');mkdirSync(directory,{recursive:true});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const rows:object[]=[];
  for(const threshold of thresholds){
    await page.evaluate(score=>window.rally.reset(score-1),threshold);
    for(const [phase,offset] of [['before',0],['arrival',.02],['during',threshold===50?.15:.65],['after',5.2]] as const){
      if(phase==='arrival')await page.evaluate(score=>window.rally.arrive(score),threshold);
      if(phase!=='before')await page.evaluate(offset=>window.rally.time(20+offset),offset);
      const record=await page.evaluate(()=>({snapshot:window.rally.snapshot(),state:window.rally.state(),stats:window.rally.stats(),resources:window.rally.resources(),geometry:window.rally.geometry(),
        gameplayPositions:window.rally.snapshot().balls.map(ball=>({ballId:ball.id,...window.rally.project(ball.position)})),
        scrollWidth:document.documentElement.scrollWidth,width:innerWidth,notice:document.querySelector('[data-rally-notice]')?.textContent}));
      expect(record.snapshot.score).toBe(phase==='before'?threshold-1:threshold);
      expect(record.gameplayPositions.every(p=>p.inView),'representative foreground balls stay inside camera').toBe(true);
      expect(record.scrollWidth).toBeLessThanOrEqual(record.width);
      expect(record.stats.tableQuads+record.stats.worldQuads).toBeLessThanOrEqual(record.stats.capacity);
      expect(record.stats.geometries).toBe(4);expect(record.stats.materials).toBe(4);
      if([1000,2000,3000,4000].includes(threshold)&&phase==='during')expect(record.notice).toBe(`${threshold} RALLY`);
      const filename=`${threshold}-${phase}.png`;
      await page.screenshot({path:resolve(directory,filename)});
      rows.push({threshold,phase,offset,screenshot:filename,...record});
    }
  }
  writeFileSync(resolve(directory,'frames.json'),JSON.stringify(rows,null,2));
  await info.attach('all-threshold-camera-metadata',{body:JSON.stringify(rows),contentType:'application/json'});
  expect(errors).toEqual([]);
});

test('moving background/electricity/rings: time sequences, deterministic restore and reduced motion',async({page},info)=>{
  test.setTimeout(180_000);
  const directory=resolve(evidenceRoot,info.project.name,'motion');mkdirSync(directory,{recursive:true});
  const rows:object[]=[];
  for(const score of [500,700,1000,1250,1500,1750,2000,2250,2500,2750,3000,3250,3500,3750,4000]){
    await page.evaluate(score=>window.rally.show(score),score);
    const shapes:unknown[]=[];
    for(const offset of (score===4000?[.1,.35,.8,1.4,2.5,3.5]:[.1,.35,.8,1.4])){
      await page.evaluate(offset=>window.rally.time(20+offset),offset);
      const geometry=await page.evaluate(()=>window.rally.geometry());shapes.push(geometry);
      await page.screenshot({path:resolve(directory,`${score}-${offset.toFixed(2)}.png`)});
      rows.push({score,offset,geometry,stats:await page.evaluate(()=>window.rally.stats())});
    }
    expect(JSON.stringify(shapes[0]),`${score} geometry changes over simulation time`).not.toBe(JSON.stringify(shapes[2]));
  }
  await page.evaluate(()=>{window.rally.show(4000,20.7);window.rally.pause();});
  const paused=await page.evaluate(()=>({state:window.rally.state(),snapshot:window.rally.snapshot(),geometry:window.rally.geometry()}));
  await page.evaluate(()=>{window.rally.advance(10);window.rally.redraw();window.rally.replayHit();window.rally.restore();});
  expect(await page.evaluate(()=>({state:window.rally.state(),snapshot:window.rally.snapshot(),geometry:window.rally.geometry()}))).toEqual(paused);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>{window.rally.resume();window.rally.reset(4001);window.rally.time(26);});
  const reduced=await page.evaluate(()=>window.rally.geometry());
  await page.evaluate(()=>window.rally.time(27));
  expect(await page.evaluate(()=>window.rally.geometry())).toEqual(reduced);
  await page.screenshot({path:resolve(directory,'4001-reduced-motion.png')});
  writeFileSync(resolve(directory,'geometry-sequence.json'),JSON.stringify(rows,null,2));
  await info.attach('target-geometry-sequences',{body:JSON.stringify(rows),contentType:'application/json'});
});

test('losses keep actual distinct positions, number lifetimes and final drawing without advancing balls',async({page},info)=>{
  test.setTimeout(180_000);
  const directory=resolve(evidenceRoot,info.project.name,'losses');mkdirSync(directory,{recursive:true});
  const rows:object[]=[];
  for(const count of [1,4,10,20,30,40,50,55,77,88,90,99,100]){
    await page.evaluate(count=>window.rally.loss(count,count===4||count===100?4:1,count===4),count);
    const initial=await page.evaluate(()=>({state:window.rally.state(),snapshot:window.rally.snapshot(),stats:window.rally.stats(),geometry:window.rally.geometry()}));
    expect(initial.state.losses.at(-1)?.count).toBe(count);
    expect(initial.state.cues.some(c=>c.kind==='loss-spark')).toBe(true);
    if(count===4){
      expect(new Set(initial.state.losses.map(loss=>JSON.stringify(loss.position))).size).toBeGreaterThan(1);
      expect(new Set(initial.state.losses.map(loss=>loss.at)).size).toBe(1);
      expect(initial.state.cues.some(c=>c.kind==='loss-impact')).toBe(true);
    }
    for(const offset of [.05,.25,.65]){
      await page.evaluate(offset=>window.rally.time(window.rally.state().losses.at(-1)!.at+offset),offset);
      await page.screenshot({path:resolve(directory,`${count}-${offset.toFixed(2)}.png`)});
      rows.push({count,offset,state:await page.evaluate(()=>window.rally.state()),stats:await page.evaluate(()=>window.rally.stats())});
    }
    if(count===100){
      await page.evaluate(()=>window.rally.finish());
      const final=await page.evaluate(()=>window.rally.snapshot());expect(await page.evaluate(()=>window.rally.finishing())).toBe(true);
      await page.evaluate(()=>window.rally.advance(.5));
      expect(await page.evaluate(()=>window.rally.snapshot())).toEqual(final);
      await page.screenshot({path:resolve(directory,'100-finishing.png')});
      await page.evaluate(()=>window.rally.advance(5));expect(await page.evaluate(()=>window.rally.finishing())).toBe(false);
    }
  }
  writeFileSync(resolve(directory,'loss-frames.json'),JSON.stringify(rows,null,2));
});

test('mobile, landscape, 200% text, best and smash warning keep controls and readable four-digit scores',async({page},info)=>{
  test.setTimeout(120_000);
  const directory=resolve(evidenceRoot,info.project.name,'layout');mkdirSync(directory,{recursive:true});
  for(const [width,height,fontPercent] of [[320,568,100],[390,844,100],[844,390,100],[390,844,200]]){
    await page.setViewportSize({width:width!,height:height!});
    await page.evaluate(percent=>document.documentElement.style.fontSize=`${percent}%`,fontPercent);
    await page.evaluate(()=>{window.rally.reset(3999,3999);window.rally.arrive(4000);window.rally.time(20.65);window.rally.warning();});
    const bounds=await page.evaluate(()=>{
      const rect=(selector:string)=>{const r=document.querySelector(selector)!.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
      return {score:rect('[data-score]'),toast:rect('[data-rally-notice]'),warning:rect('[data-smash-warning]'),
        pointer:getComputedStyle(document.querySelector('[data-rally-notice]')!).pointerEvents,
        scroll:document.documentElement.scrollWidth,width:innerWidth,live:document.querySelector('[data-rally-live]')!.textContent};
    });
    expect(bounds.scroll).toBeLessThanOrEqual(bounds.width);expect(bounds.score.right).toBeLessThanOrEqual(bounds.width);
    expect(bounds.pointer).toBe('none');expect(bounds.live).toBe('4000 RALLY');
    expect(bounds.toast.y>=bounds.warning.bottom||bounds.toast.right<=bounds.warning.x||bounds.toast.bottom<=bounds.warning.y).toBe(true);
    await page.screenshot({path:resolve(directory,`${width}x${height}-text${fontPercent}.png`)});
  }
});

test('major labels fit at their largest initial scale with 200% text on 320px screens',async({page},info)=>{
  await page.setViewportSize({width:320,height:568});
  await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
  const directory=resolve(evidenceRoot,info.project.name,'layout');mkdirSync(directory,{recursive:true});
  for(const score of [1000,2000,3000,4000]){
    await page.evaluate(score=>window.rally.show(score),score);
    const bounds=await page.evaluate(()=>{
      const game=document.querySelector('[data-game]')!.getBoundingClientRect();
      const wrapper=document.querySelector('[data-rally-notice]')!.getBoundingClientRect();
      const label=document.querySelector('.rally-toast-label')!.getBoundingClientRect();
      return {game:{left:game.left,right:game.right,top:game.top,bottom:game.bottom},wrapper:{left:wrapper.left,right:wrapper.right,top:wrapper.top,bottom:wrapper.bottom},label:{left:label.left,right:label.right,top:label.top,bottom:label.bottom}};
    });
    await page.screenshot({path:resolve(directory,`${score}-320x568-text200-age0.png`)});
    expect(bounds.label.left).toBeGreaterThanOrEqual(bounds.game.left);expect(bounds.label.right).toBeLessThanOrEqual(bounds.game.right);
    expect(bounds.label.top).toBeGreaterThanOrEqual(bounds.game.top);expect(bounds.label.bottom).toBeLessThanOrEqual(bounds.game.bottom);
    expect(bounds.wrapper.left).toBeGreaterThanOrEqual(bounds.game.left);expect(bounds.wrapper.right).toBeLessThanOrEqual(bounds.game.right);
  }
});

test('300 gold rays visibly radiate behind the rally number at age0.65',async({page},info)=>{
  await page.evaluate(()=>window.rally.show(300,20.65));
  const host=await page.locator('.rally-score-host').boundingBox();
  if(!host)throw new Error('Missing score host');
  const clip={x:Math.max(0,Math.floor(host.x-12)),y:Math.max(0,Math.floor(host.y-12)),width:Math.ceil(host.width+24),height:Math.ceil(host.height+24)};
  const withAura=await page.screenshot({clip});
  await page.locator('.rally-score-aura').evaluate(element=>(element as HTMLElement).style.visibility='hidden');
  const withoutAura=await page.screenshot({clip});
  await page.locator('.rally-score-aura').evaluate(element=>(element as HTMLElement).style.visibility='visible');
  const measured=goldContribution(withAura,withoutAura);
  await info.attach('gold-ray-with-aura',{body:withAura,contentType:'image/png'});
  await info.attach('gold-ray-without-aura',{body:withoutAura,contentType:'image/png'});
  await info.attach('gold-ray-pixel-measurement',{body:JSON.stringify(measured),contentType:'application/json'});
  expect(measured.count,'at least80pixels show >=15%red/+10%green/-5%blue gold contribution').toBeGreaterThanOrEqual(80);
  expect(measured.quadrants.filter(count=>count>=10).length,'gold spokes radiate across at least3 quadrants').toBeGreaterThanOrEqual(3);
});
