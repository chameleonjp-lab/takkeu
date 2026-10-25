import { expect,test } from '../helpers/browserTest';
import type {} from '../helpers/celebrationHarness';
test.use({viewport:{width:390,height:844},video:'off'});

test('落球電撃の増大・4球目の揺れと全14種類の落球数字を描き、指定色へ点滅する',async({page},info)=>{
  test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/tests/fixtures/celebrations.html');await page.waitForFunction(()=>!!window.celebrations);
  await page.evaluate(()=>window.celebrations.show({}));const baseline=await page.locator('canvas').screenshot();
  for(const streak of [1,2,4,8]){
    await page.evaluate(streak=>window.celebrations.show({loss:streak,streak}),streak);
    expect(await page.evaluate(()=>window.celebrations.frame().netBolts)).toBe(4+streak*2);
    const image=await page.locator('canvas').screenshot({path:info.outputPath(`net-combo-${streak}.png`)});
    expect(image.equals(baseline)).toBe(false);
  }
  for(const loss of [10,20,30,40,50,55,60,70,77,80,88,90,99,100]){
    await page.evaluate(loss=>window.celebrations.show({loss,time:1}),loss);
    expect(await page.evaluate(()=>window.celebrations.frame().numbers.map(n=>n.value))).toEqual([loss]);
    expect((await page.locator('canvas').screenshot({path:info.outputPath(`loss-${loss}.png`)})).equals(baseline)).toBe(false);
  }
  for(const [loss,palette]of [[55,'black'],[77,'blue'],[88,'green'],[99,'gold']] as const){
    await page.evaluate(loss=>window.celebrations.show({loss,time:1.21}),loss);
    expect(await page.evaluate(()=>window.celebrations.frame().numbers[0]!.palette)).toBe('rainbow');
    const rainbow=await page.locator('canvas').screenshot({path:info.outputPath(`loss-${loss}-rainbow.png`)});
    await page.evaluate(()=>window.celebrations.time(1.51));
    expect(await page.evaluate(()=>window.celebrations.frame().numbers[0]!.palette)).toBe(palette);
    expect(rainbow.equals(await page.locator('canvas').screenshot({path:info.outputPath(`loss-${loss}-${palette}.png`)}))).toBe(false);
    await page.evaluate(()=>window.celebrations.time(2.99));expect(await page.evaluate(()=>window.celebrations.frame().numbers.length)).toBe(1);
    await page.evaluate(()=>window.celebrations.time(3));expect(await page.evaluate(()=>window.celebrations.frame().numbers.length)).toBe(0);
  }
  expect(errors).toEqual([]);
});

test('ゾロ目の緑電撃と100単位の床壁点滅が5秒で消え、停止・復旧・新規プレイを尊重する',async({page},info)=>{
  test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/tests/fixtures/celebrations.html');await page.waitForFunction(()=>!!window.celebrations);
  for(const rally of [11,22,111,222]){
    await page.evaluate(rally=>window.celebrations.show({rally,time:.2}),rally);
    expect(await page.evaluate(()=>window.celebrations.frame().edgeElectric)).toBe(true);
    const green=await page.locator('canvas').screenshot({path:info.outputPath(`repdigit-${rally}.png`)});
    await page.evaluate(()=>window.celebrations.time(5));expect(await page.evaluate(()=>window.celebrations.frame().edgeElectric)).toBe(false);
    expect(green.equals(await page.locator('canvas').screenshot())).toBe(false);
  }
  for(const rally of [100,200,500]){
    await page.evaluate(rally=>window.celebrations.show({rally,time:.2}),rally);
    expect(await page.evaluate(()=>window.celebrations.frame().environment)).toBe('rainbow');
    const rainbow=await page.locator('canvas').screenshot({path:info.outputPath(`century-${rally}-rainbow.png`)});
    await page.evaluate(()=>window.celebrations.time(.4));expect(await page.evaluate(()=>window.celebrations.frame().environment)).toBe('gold');
    expect(rainbow.equals(await page.locator('canvas').screenshot({path:info.outputPath(`century-${rally}-gold.png`)}))).toBe(false);
    await page.evaluate(()=>window.celebrations.time(4.99));expect(await page.evaluate(()=>window.celebrations.frame().environment)).not.toBe(null);
    await page.evaluate(()=>window.celebrations.time(5));expect(await page.evaluate(()=>window.celebrations.frame().environment)).toBe(null);
  }
  await page.evaluate(()=>window.celebrations.show({loss:88,streak:8,rally:111,time:.35}));
  await page.keyboard.press('Escape');const paused=await page.evaluate(()=>window.celebrations.snapshot());
  const image=await page.locator('canvas').screenshot();
  await page.evaluate(()=>window.celebrations.advance(10));expect(await page.evaluate(()=>window.celebrations.snapshot())).toEqual(paused);
  expect(image.equals(await page.locator('canvas').screenshot())).toBe(true);
  await page.evaluate(()=>window.celebrations.restore());expect(image.equals(await page.locator('canvas').screenshot())).toBe(true);
  await page.getByRole('button',{name:'つづける',exact:true}).click();await page.evaluate(()=>window.celebrations.advance(5));
  expect(await page.evaluate(()=>window.celebrations.frame())).toMatchObject({netBolts:0,numbers:[],edgeElectric:false,environment:null});
  await page.evaluate(()=>window.celebrations.show({}));expect(await page.evaluate(()=>window.celebrations.frame().netBolts)).toBe(0);
  const warm=await page.evaluate(()=>{window.celebrations.show({loss:100,streak:100,rally:111});return window.celebrations.resources();});
  await page.evaluate(()=>{for(let i=0;i<100;i++)window.celebrations.time(i/1000);});
  const end=await page.evaluate(()=>window.celebrations.resources());
  expect(end.geometries).toBe(warm.geometries);expect(end.textures).toBe(warm.textures);expect(end.programs).toBe(warm.programs);
  expect(end.drawCalls).toBeLessThan(50);expect(errors).toEqual([]);
});
