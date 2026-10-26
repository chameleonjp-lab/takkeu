import { test,expect } from '../helpers/browserTest';

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
