import { test, expect } from '../helpers/browserTest';
import { inspectShareTarget } from '../helpers/shareVisibility';
import type {} from '../helpers/resultHarness';
const locales=['ja','en','es','pt-BR','zh-Hans','fr','de','ko','ru','it','zh-Hant','id','tr','vi','th'];
test.use({hasTouch:true});
for(const locale of locales)for(const orientation of ['portrait',...(['ja','en','de'].includes(locale)?['landscape']:[])]){
 test(`formal X home/result ${locale} ${orientation}`,async({page,context},info)=>{
  await page.setViewportSize(orientation==='portrait'?{width:393,height:852}:{width:852,height:393});
  const errors:string[]=[],intents:string[]=[];let expectedIntent='';
  page.on('pageerror',error=>errors.push(error.message));
  await context.addInitScript(()=>{localStorage.setItem('takkeu.preferences.v1',JSON.stringify({version:1,bestScore:0,volume:0,muted:true,sensitivity:1,quality:'low'}))});
  await context.route('https://twitter.com/**',async route=>{
   expect(route.request().method()).toBe('GET');expect(route.request().headers()['referer']).toBeUndefined();expect(route.request().url()).toBe(expectedIntent);intents.push(route.request().url());
   await route.fulfill({contentType:'text/html',body:'<!doctype html><title>Network-isolated X composer</title>'});
  });
  for(const screen of ['home','result'] as const){
   // A result presentation fixture is not a claimed gameplay completion or screenshot source.
   await page.goto(screen==='home'?'/':'/tests/fixtures/result.html');
   await page.locator('[data-home] [data-language]').selectOption(locale);
   if(screen==='result')await page.evaluate(()=>window.resultHarness.show(37));
   const link=page.locator(screen==='home'?'[data-share-home-x]':'[data-share-x]');await link.scrollIntoViewIfNeeded();
   const geometry=await link.evaluate(inspectShareTarget);
   for(const key of ['visible','viewport','unclipped','hit','fits'] as const)expect(geometry[key],JSON.stringify(geometry)).toBe(true);
   expect(geometry.width).toBeGreaterThanOrEqual(44);expect(geometry.height).toBeGreaterThanOrEqual(44);
   expect(await link.evaluate(el=>({color:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor}))).toEqual({color:'rgb(255, 255, 255)',background:'rgb(0, 0, 0)'});
   expect(await page.locator('.share-copy,[data-share-home-copy],[data-share-result-copy]').count()).toBe(0);
   expectedIntent=await page.evaluate(async value=>{
    const moduleUrl='/src/ranking/config.ts';const {homeShareUrl,scoreShareUrl}=await import(moduleUrl);return value==='home'?homeShareUrl(0):scoreShareUrl(37);
   },screen) as string;
   expect(await link.getAttribute('href')).toBe(expectedIntent);expect(new URL(expectedIntent).searchParams.get('text')).toMatch(/\n#タッケウ #ゲーム制作$/u);
   const before=await page.evaluate(()=>({preferences:localStorage.getItem('takkeu.preferences.v1'),score:document.querySelector('[data-result-score]')?.textContent}));
   if(['ja','en','de'].includes(locale))await page.screenshot({path:info.outputPath(`${locale}-${orientation}-${screen}.png`)});
   const count=intents.length,popupReady=page.waitForEvent('popup');await link.tap();const popup=await popupReady;await popup.waitForURL(expectedIntent);await popup.waitForLoadState('domcontentloaded');expect(await popup.title()).toBe('Network-isolated X composer');expect(await popup.evaluate(()=>window.opener===null)).toBe(true);expect(intents.length).toBe(count+1);await popup.close();
   expect(await page.evaluate(()=>({preferences:localStorage.getItem('takkeu.preferences.v1'),score:document.querySelector('[data-result-score]')?.textContent}))).toEqual(before);
   await info.attach(`${screen}-geometry`,{body:JSON.stringify({locale,orientation,screen,geometry,intentCount:1,upstreamRequests:0}),contentType:'application/json'});
  }
  expect(errors).toEqual([]);
 });
}
