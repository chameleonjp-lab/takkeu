import {test,expect} from '../helpers/browserTest';
import type {} from '../helpers/rallyGlHarness';

test('default live rally feedback uses two single-pass submissions within the four-draw ceiling',async({context,page},info)=>{
  await context.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4176'?route.continue():route.abort());
  await page.goto('/tests/fixtures/rally-gl.html');
  await page.waitForFunction(()=>Boolean(window.rallyGl),{},{timeout:60_000});
  const result=await page.evaluate(()=>window.rallyGl.defaultContribution());
  await info.attach('default-rally-draw-budget.json',{body:JSON.stringify(result,null,2),contentType:'application/json'});
  expect(result.snapshot.score).toBeGreaterThanOrEqual(555);
  expect(result.snapshot.score).toBeLessThan(3500);
  expect(result.snapshot.phase).toBe('running');
  expect(result.snapshot.endReason).toBeNull();
  expect(result.snapshot.runId).toBe(result.stateRunId);
  expect(result.snapshot.balls).toBe(30);
  expect(result.snapshot.lostBallCount).toBe(1);
  expect(result.activeGeometry.tableQuads).toBeGreaterThan(0);
  expect(result.activeGeometry.worldQuads).toBeGreaterThan(0);
  expect(result.activeGeometry.drawCalls).toBe(2);
  expect(result.contribution).toBeLessThanOrEqual(4);
  expect(result.contribution).toBe(2);
});

for(const quality of ['standard','low'] as const)for(const frame of ['peak','middle'] as const){
  test(`diagnostic frozen4000 ${quality} ${frame}`,async({context,page},info)=>{
    test.setTimeout(180_000);
    const errors:string[]=[],blocked:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    await context.route('**/*',route=>{
      if(new URL(route.request().url()).origin==='http://127.0.0.1:4176')return route.continue();
      blocked.push(route.request().url());return route.abort();
    });
    await page.goto('/tests/fixtures/rally-gl.html');
    await page.waitForFunction(()=>Boolean(window.rallyGl),{},{timeout:60_000});
    const result=await page.evaluate(async({frame,quality})=>window.rallyGl.profile(frame,quality,8),{frame,quality});
    for(const[name,url]of Object.entries(result.captures))await info.attach(`${quality}-${frame}-${name}.png`,{body:Buffer.from(url.split(',')[1]!,'base64'),contentType:'image/png'});
    await info.attach(`gl-${quality}-${frame}.json`,{body:JSON.stringify({...result,captures:undefined,errors,blocked},null,2),contentType:'application/json'});
    expect(errors).toEqual([]);expect(blocked).toEqual([]);expect(result.snapshot.balls).toBe(30);
    expect(result.pixelDifference.changedChannels).toBe(0);
  });
}
