import { expect, test, waitForStart } from '../helpers/browserTest';
import { SUPPORTED_LANGUAGES } from '../../src/i18n/languages';
import type {} from '../helpers/appHarness';

const kana = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
const shots = new Set(['de','ru','zh-Hans','zh-Hant','ko','th','vi']);
async function language(page: import('@playwright/test').Page, id: string) {
  await page.evaluate(async next => { const path='/src/i18n/i18n.ts'; (await import(/* @vite-ignore */ path)).setLanguage(next); }, id);
}
// URL module imports stay in this test fixture; the production build exposes no test hooks.
for (const { id } of SUPPORTED_LANGUAGES) test(`i18n ${id}: all principal screens, live state and PNG`, async ({ page }, info) => {
  await page.setViewportSize({width:402,height:700});
  await page.clock.install(); await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.goto('/tests/fixtures/stage3.html');
  await page.locator('[data-home] [data-language]').selectOption(id);
  await expect(page.locator('html')).toHaveAttribute('lang', id);
  expect(await page.locator('[data-home] [data-language] option').count()).toBe(15);
  const start=page.locator('[data-action="start"]');
  const box=await start.boundingBox(); expect(box).not.toBeNull();
  expect(box!.y+box!.height, 'Start stays visible on a short phone viewport').toBeLessThanOrEqual(700);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  const overflow=()=>page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
  expect(await overflow()).toBe(false);
  if(id!=='ja') expect(await page.locator('.hero-description').innerText()).not.toMatch(kana);
  if(shots.has(id)) await page.screenshot({path:`docs/i18n/screenshots/${info.project.name}-${id}-home.png`,fullPage:true});
  await page.locator('[data-action="settings"]').click();
  await expect(page.locator('[data-settings]')).toBeVisible();
  await expect(page.locator('[data-settings] [data-language]')).toHaveValue(id);
  if(id!=='ja') expect(await page.locator('[data-settings] > p:not(.eyebrow)').innerText()).not.toMatch(kana);
  await page.locator('[data-action="settings-back"]').click();
  await start.click();
  await expect(page.locator('[data-loading-screen]')).toBeVisible();
  if(id!=='ja') expect(await page.locator('[data-loading-screen] h2').innerText()).not.toMatch(kana);
  await waitForStart(page);
  await page.evaluate(()=>window.stage3.show(555)); await page.clock.runFor(16);
  const before=await page.evaluate(()=>({snapshot:window.stage3.snapshot(),metrics:window.stage3.metrics(),resources:window.stage3.resources()}));
  const same=await page.evaluate(async chosen=>{
    const canvas=document.querySelector('canvas'), surface=document.querySelector('[data-testid="input-surface"]');
    const path='/src/i18n/i18n.ts'; const mod=await import(/* @vite-ignore */ path);
    for(let i=0;i<30;i++) { mod.setLanguage('ja');mod.setLanguage(chosen); }
    return canvas===document.querySelector('canvas') && surface===document.querySelector('[data-testid="input-surface"]');
  },id);
  expect(same).toBe(true);
  const after=await page.evaluate(()=>({snapshot:window.stage3.snapshot(),metrics:window.stage3.metrics(),resources:window.stage3.resources()}));
  expect(after).toEqual(before);
  await page.keyboard.press('Escape'); await expect(page.locator('.pause-overlay')).toBeVisible();
  if(id!=='ja') expect(await page.locator('[data-pause-message]').innerText()).not.toMatch(kana);
  if(shots.has(id)) await page.screenshot({path:`docs/i18n/screenshots/${info.project.name}-${id}-pause.png`});
  await page.locator('[data-action="resume"]').click();
  await page.evaluate(()=>window.stage3.goal());await page.clock.runFor(3200);
  await expect(page.locator('[data-result]')).toBeVisible();
  await expect(page.locator('[data-result]')).toHaveAttribute('data-cleared','true');
  const text=new URL((await page.locator('[data-share-x]').getAttribute('href'))!).searchParams.get('text')!;
  expect(text).toContain('3500');expect(text).toContain('https://chameleonjp-lab.github.io/takkeu/');
  if(id!=='ja') expect(text).not.toMatch(kana);
  await page.locator('[data-certificate-create]').click();
  await expect(page.locator('[data-certificate-preview]')).toBeVisible();
  const size=await page.locator('[data-certificate-image]').evaluate((img:HTMLImageElement)=>[img.naturalWidth,img.naturalHeight]);
  expect(size).toEqual([900,1200]);
  if(id!=='ja') expect(await page.locator('[data-certificate-image]').getAttribute('alt')).not.toMatch(kana);
  expect(await overflow()).toBe(false);
  if(shots.has(id)) {
    await page.screenshot({path:`docs/i18n/screenshots/${info.project.name}-${id}-result.png`,fullPage:true});
    const png=await page.locator('[data-certificate-image]').evaluate(async(img:HTMLImageElement)=>Array.from(new Uint8Array(await(await fetch(img.src)).arrayBuffer())));
    await import('node:fs/promises').then(fs=>fs.writeFile(`docs/i18n/screenshots/${info.project.name}-${id}-certificate.png`,Buffer.from(png)));
  }
  await page.locator('[data-result] [data-action="home"]').click();
  await expect(page.locator('[data-home]')).toBeVisible();
  await language(page,'ja');
  await expect(start).toContainText('はじめる');
});

test('i18n browser preference and saved language are separate from gameplay storage',async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperties(navigator,{languages:{get:()=>['zh-HK','en']},language:{get:()=> 'en'}});
  });
  await page.goto('/');await expect(page.locator('html')).toHaveAttribute('lang','zh-Hant');
  await page.locator('[data-home] [data-language]').selectOption('es');
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('takkeu.language.v1'))).toBe('es');
  await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','es');
});
