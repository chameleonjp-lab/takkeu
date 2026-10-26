import { test, expect, waitForStart } from '../helpers/browserTest';
import type {} from '../helpers/appHarness';

test.use({video:'off'});

async function chooseAuto(page:import('@playwright/test').Page){
  await page.getByRole('button',{name:'設定',exact:true}).click();
  await page.getByLabel('描画品質',{exact:true}).selectOption('auto');
  await page.getByRole('button',{name:'戻る',exact:true}).click();
}
async function start(page:import('@playwright/test').Page){
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.goto('/tests/fixtures/stage3.html');await chooseAuto(page);
  await page.getByRole('button',{name:'はじめる',exact:true}).click();await waitForStart(page);
  await page.evaluate(()=>window.stage3.parkForInput());
}
async function dimensions(page:import('@playwright/test').Page){
  return page.evaluate(()=>{const c=document.querySelector('canvas')!,r=c.getBoundingClientRect();return {buffer:{width:c.width,height:c.height},css:{left:r.left,top:r.top,width:r.width,height:r.height},paddle:window.stage3.snapshot().paddle,changes:window.stage3.qualityChanges()};});
}

// Fast-forward delivers one RAF per call: actual product controller sees sustained
// 40ms frames while the unchanged physical loop retains its normal catch-up rules.
test('auto lowers in actual RAF flow and returns after stability; manual modes never adjust',async({page},info)=>{
  test.setTimeout(180000);await start(page);
  // Policy integration uses a virtual workload. Keep real buffer reallocations,
  // but avoid thousands of redundant software-GPU draws. Other tests and all
  // formal performance runs render every frame normally.
  await page.evaluate(()=>window.stage3.renderEnabled(false));
  const before=await dimensions(page);
  for(let frame=0;frame<190;frame++)await page.clock.fastForward(40);
  const middle=await dimensions(page);await info.attach('high-load-state.json',{body:JSON.stringify({before,middle,debug:await page.evaluate(()=>Reflect.get(window,'__qualityDebug')?.())}),contentType:'application/json'});expect(middle.changes.filter(c=>c.level===1)).toHaveLength(1);
  for(let frame=0;frame<400;frame++)await page.clock.fastForward(40);
  const low=await dimensions(page);expect(low.changes.filter(c=>c.level===2)).toHaveLength(1);
  expect(low.buffer.width).toBeLessThanOrEqual(before.buffer.width);expect(low.css).toEqual(before.css);
  await page.clock.runFor(48000);
  const stable=await dimensions(page);expect(stable.changes.some(c=>c.level===0)).toBe(true);
  const transitions=stable.changes.filter((c,i,a)=>i===0||c.level!==a[i-1]!.level);
  for(let i=1;i<transitions.length;i++)expect(transitions[i]!.at-transitions[i-1]!.at).toBeGreaterThanOrEqual(10000);
  await info.attach('auto-transitions.json',{body:JSON.stringify({before,middle,low,stable}),contentType:'application/json'});
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'ホームへ',exact:true}).click();
  for(const quality of ['standard','low']){
    await page.getByRole('button',{name:'設定',exact:true}).click();await page.getByLabel('描画品質',{exact:true}).selectOption(quality);await page.getByRole('button',{name:'戻る',exact:true}).click();
    await page.getByRole('button',{name:'はじめる',exact:true}).click();await waitForStart(page);await page.evaluate(()=>window.stage3.parkForInput());
    const initial=await dimensions(page);
    for(let i=0;i<180;i++)await page.clock.fastForward(50);
    expect((await dimensions(page)).buffer).toEqual(initial.buffer);
    expect((await dimensions(page)).changes.length).toBe(initial.changes.length);
    await page.keyboard.press('Escape');await page.getByRole('button',{name:'ホームへ',exact:true}).click();
  }
});

test('held pointer survives buffer changes with <1 CSS pixel error at center and edges',async({page},info)=>{
  test.setTimeout(120000);await start(page);
  const errors:object[]=[];
  const surface=page.getByTestId('input-surface');
  for(const level of [0,1,2,1,0]){
    const initial=await dimensions(page);
    const rect=initial.css,x=rect.left+rect.width/2,y=rect.top+rect.height*.65;
    await surface.dispatchEvent('pointerdown',{pointerId:71,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,buttons:1});
    await page.clock.runFor(16);
    const stationary=await dimensions(page);
    await page.evaluate(level=>window.stage3.setResolutionLevel(level),level);
    await page.clock.runFor(16);
    const changed=await dimensions(page);
    expect(changed.css).toEqual(initial.css);expect(changed.paddle).toEqual(stationary.paddle);
    for(const [u,v] of [[.5,.5],[.05,.5],[.95,.5],[.5,.05],[.5,.95],[.05,.05],[.95,.95],[.05,.95],[.95,.05]]){
      const px=rect.left+rect.width*u!,py=rect.top+rect.height*v!;
      await surface.dispatchEvent('pointermove',{pointerId:71,pointerType:'touch',isPrimary:true,clientX:px,clientY:py,buttons:1});await page.clock.runFor(16);
      const check=await page.evaluate(({x,y})=>window.stage3.inputError(x,y),{x:px,y:py});errors.push({level,u,v,...check});
      expect(check.errorCssPx).toBeLessThan(1);expect(check.phase).toBe('running');
    }
    await surface.dispatchEvent('pointerup',{pointerId:71,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,buttons:0});
  }
  await info.attach('held-pointer-coordinates.json',{body:JSON.stringify(errors),contentType:'application/json'});
});

test('rotation, pause, hidden, context restore and retry discard history without changing input',async({page},info)=>{
  test.setTimeout(120000);await start(page);
  for(let i=0;i<145;i++)await page.clock.fastForward(40); // insufficient for two full overloaded windows
  await page.keyboard.press('Escape');await page.clock.fastForward(120000);
  await page.getByRole('button',{name:'つづける',exact:true}).click();await page.clock.runFor(32);
  expect((await dimensions(page)).changes).toHaveLength(0);
  for(let i=0;i<195;i++)await page.clock.fastForward(40);
  await page.setViewportSize({width:874,height:402});await page.clock.runFor(160);
  expect(await page.evaluate(()=>window.stage3.snapshot().phase)).toBe('paused');
  await page.getByRole('button',{name:'つづける',exact:true}).click();await page.clock.runFor(32);
  const rotated=await dimensions(page);expect(rotated.css.width).toBeGreaterThan(rotated.css.height);
  const box=rotated.css;
  await page.getByTestId('input-surface').dispatchEvent('pointerdown',{pointerId:91,pointerType:'touch',isPrimary:true,clientX:box.left+box.width/2,clientY:box.top+box.height/2,buttons:1});
  await page.clock.runFor(16);
  expect(await page.evaluate(()=>{const r=document.querySelector('canvas')!.getBoundingClientRect();return window.stage3.inputError(r.left+r.width/2,r.top+r.height/2).errorCssPx;})).toBeLessThan(1);
  await page.getByTestId('input-surface').dispatchEvent('pointerup',{pointerId:91,pointerType:'touch',isPrimary:true,clientX:box.left+box.width/2,clientY:box.top+box.height/2,buttons:0});
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  await page.clock.fastForward(120000);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
  await page.getByRole('button',{name:'つづける',exact:true}).click();await page.clock.runFor(32);
  const beforeLoss=await dimensions(page);
  await page.evaluate(()=>document.querySelector('canvas')!.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));
  await page.evaluate(()=>window.stage3.restore());await page.clock.runFor(32);
  await page.getByRole('button',{name:'つづける',exact:true}).click();await page.clock.runFor(32);
  const restored=await dimensions(page);expect(restored.buffer).toEqual(beforeLoss.buffer);expect(restored.css).toEqual(beforeLoss.css);
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'ホームへ',exact:true}).click();
  await page.getByRole('button',{name:'はじめる',exact:true}).click();await waitForStart(page);await page.evaluate(()=>window.stage3.parkForInput());
  const retry=await dimensions(page);expect(retry.buffer.width).toBeGreaterThanOrEqual(restored.buffer.width);
  expect(await page.evaluate(()=>window.stage3.snapshot().phase)).toBe('running');
  await info.attach('lifecycle-resolution.json',{body:JSON.stringify({rotated,beforeLoss,restored,retry}),contentType:'application/json'});
});


test('short pause, hidden and context interruptions clear a primed window independently of the gap guard',async({page},info)=>{
  test.setTimeout(180000);await start(page);
  // Synthetic policy integration; held-pointer/lifecycle tests keep full rendering.
  await page.evaluate(()=>window.stage3.renderEnabled(false));
  const records=[];
  for(const kind of ['pause','hidden','context'] as const){
    if(kind!=='pause'){
      await page.keyboard.press('Escape');await page.getByRole('button',{name:'ホームへ',exact:true}).click();
      await page.getByRole('button',{name:'はじめる',exact:true}).click();await waitForStart(page);await page.evaluate(()=>window.stage3.parkForInput());
    }
    const count=(await dimensions(page)).changes.length;
    for(let i=0;i<145;i++)await page.clock.fastForward(40);
    if(kind==='pause')await page.keyboard.press('Escape');
    else if(kind==='hidden')await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
    else await page.evaluate(()=>document.querySelector('canvas')!.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));
    await page.clock.fastForward(200); // strictly below maxSampleGapMs
    if(kind==='hidden')await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
    if(kind==='context')await page.evaluate(()=>window.stage3.restore());
    await page.getByRole('button',{name:'つづける',exact:true}).click();
    for(let i=0;i<115;i++)await page.clock.fastForward(40);
    const result=await dimensions(page);records.push({kind,result});
    expect(result.changes.length).toBe(count);
    expect(await page.evaluate(()=>window.stage3.snapshot().phase)).toBe('running');
  }
  await info.attach('short-interruption-history.json',{body:JSON.stringify(records),contentType:'application/json'});
});
