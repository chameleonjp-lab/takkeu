import { test,expect,waitForStart } from '../helpers/browserTest';

test('test-only iPhone recorder requires started play and blocks off-origin fetch',async({page})=>{
  const external:string[]=[];
  page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4173'))external.push(r.url());});
  await page.goto('/tests/fixtures/performance-iphone.html');
  const panel=page.getByRole('region',{name:'実機診断専用'});
  await expect(panel).toBeVisible();
  await page.getByRole('button',{name:'60秒計測',exact:true}).click();
  await expect(panel).toContainText('先に');
  const blocked=await page.evaluate(()=>fetch('https://not-allowed.invalid/score').then(()=>false,error=>String(error).includes('外部通信を遮断')));
  expect(blocked).toBe(true);expect(external).toEqual([]);
});

test('LAN HTTP相当の非secure originでも起動し60秒の診断記録を保存できる',async({page})=>{
  test.setTimeout(120_000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  // Route an intentionally insecure origin entirely to the local test server.
  // No external hostname is resolved or contacted.
  await page.route('http://device-lan.invalid/**',async route=>{
    const url=new URL(route.request().url());
    await route.fulfill({response:await route.fetch({url:`http://127.0.0.1:4173${url.pathname}${url.search}`})});
  });
  await page.routeWebSocket('**/*',socket=>socket.close());
  await page.clock.install({time:new Date('2026-10-26T00:00:00Z')});
  await page.clock.pauseAt(new Date('2026-10-26T00:00:01Z'));
  await page.goto('http://device-lan.invalid/tests/fixtures/performance-iphone.html');
  expect(await page.evaluate(()=>isSecureContext)).toBe(false);
  await page.getByRole('button',{name:'パネルを閉じる',exact:true}).click();
  await page.getByRole('button',{name:'はじめる',exact:true}).click();await waitForStart(page);
  await page.getByRole('button',{name:'診断',exact:true}).click();
  await page.getByRole('button',{name:'60秒計測',exact:true}).click();
  // Exercise recorder completion only; fast-forward is deliberately NOT a
  // device performance result and the unchanged slow-frame guard may pause.
  await page.clock.fastForward(61000);
  const save=page.getByRole('link',{name:'測定JSONを保存',exact:true});await expect(save).toBeVisible();
  const record=await save.evaluate(async element=>JSON.parse(await (await fetch((element as HTMLAnchorElement).href)).text()));
  expect(record.durationMs).toBeGreaterThanOrEqual(60000);
  expect(record.errors).toEqual([]);expect(record.secureContext).toBe(false);
  expect(errors).toEqual([]);
});
