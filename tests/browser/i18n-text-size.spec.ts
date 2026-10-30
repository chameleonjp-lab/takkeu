import { expect, test } from '../helpers/browserTest';
import { SUPPORTED_LANGUAGES } from '../../src/i18n/languages';

test('i18n home keeps natural header and disclosure flow at 200 percent text in portrait and landscape', async ({ page }, info) => {
  await page.goto('/');
  await page.evaluate(() => { document.documentElement.style.fontSize='200%'; });
  for (const viewport of [{width:402,height:700},{width:844,height:390}]) {
    await page.setViewportSize(viewport);
    for (const {id} of SUPPORTED_LANGUAGES) {
      await page.locator('[data-home] [data-language]').selectOption(id);
      const bounds=await page.evaluate(()=>{
        const rect=(selector:string)=>document.querySelector(selector)!.getBoundingClientRect();
        const header=rect('[data-home] .brand'), selector=rect('[data-home] [data-language]'), hero=rect('.home-hero');
        return {overflow:document.documentElement.scrollWidth-innerWidth,headerBottom:header.bottom,selectorBottom:selector.bottom,heroTop:hero.top};
      });
      expect(bounds.overflow,`${id} ${viewport.width}`).toBeLessThanOrEqual(1);
      expect(bounds.selectorBottom).toBeLessThanOrEqual(bounds.headerBottom+1);
      expect(bounds.heroTop).toBeGreaterThanOrEqual(bounds.headerBottom-1);
      const details=page.locator('.name-details');await details.evaluate((node:HTMLDetailsElement)=>{node.open=true;});
      await expect(page.locator('[data-name-note]')).toBeVisible();
      const input=await page.locator('[data-player-name]').boundingBox(),note=await page.locator('[data-name-note]').boundingBox(),start=await page.locator('[data-action="start"]').boundingBox();
      expect(note!.y).toBeGreaterThanOrEqual(input!.y+input!.height);
      expect(start!.y).toBeGreaterThanOrEqual(note!.y+note!.height);
      await details.evaluate((node:HTMLDetailsElement)=>{node.open=false;});
      await page.locator('[data-action="start"]').scrollIntoViewIfNeeded();
      expect((await page.locator('[data-action="start"]').boundingBox())!.height).toBeGreaterThanOrEqual(44);
      if(['th','de'].includes(id)) await page.screenshot({path:`docs/i18n/screenshots/${info.project.name}-${id}-home-${viewport.width}-200.png`,fullPage:true});
    }
  }
});

test('i18n Start remains within 700px with OS fallback fonts in every language', async ({ page }) => {
  await page.setViewportSize({width:402,height:700});await page.goto('/');
  for(const family of ['system-ui, sans-serif','Arial, sans-serif']) {
    await page.evaluate(value=>{document.documentElement.style.fontFamily=value;},family);
    for(const {id} of SUPPORTED_LANGUAGES) {
      await page.locator('[data-home] [data-language]').selectOption(id);
      const box=await page.locator('[data-action="start"]').boundingBox();
      expect(box!.y+box!.height,`${id} ${family}`).toBeLessThanOrEqual(700);
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
    }
  }
});
