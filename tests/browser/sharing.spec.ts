import { expect, test } from '../helpers/browserTest';
import type { BrowserContext, Locator, Page } from '@playwright/test';
import type {} from '../helpers/appHarness';

const canonicalUrl = 'https://chameleonjp-lab.github.io/takkeu/';
const genericText = 'タップ＆ドラッグで遊べる卓球ゲーム「タッケウ」！\n何ラリーつなげられる？ #タッケウ';

async function blockX(context: BrowserContext) {
  const intents: string[] = [];
  await context.route('https://twitter.com/**', async route => {
    expect(route.request().method()).toBe('GET');
    expect(new URL(route.request().url()).pathname).toBe('/intent/tweet');
    intents.push(route.request().url());
    await route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Intercepted share intent</title>' });
  });
  return intents;
}

async function expectIntent(link: Locator, text: string) {
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  const url = new URL(await link.getAttribute('href') ?? '');
  expect(url.origin + url.pathname).toBe('https://twitter.com/intent/tweet');
  expect(url.searchParams.get('url')).toBe(canonicalUrl);
  expect(url.searchParams.get('text')).toBe(text);
}

async function activateIntent(page: Page, link: Locator, text: string, keyboard = false) {
  await expectIntent(link, text);
  const popupReady = page.waitForEvent('popup');
  if (keyboard) { await expect(link).toBeFocused(); await page.keyboard.press('Enter'); }
  else await link.click();
  const popup = await popupReady;
  await popup.waitForLoadState('domcontentloaded');
  expect(new URL(popup.url()).searchParams.get('text')).toBe(text);
  expect(await popup.evaluate(() => window.opener === null)).toBe(true);
  await popup.close();
}

async function openHarness(page: Page, bestScore = 0) {
  await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  if (bestScore) await page.addInitScript(best => {
    if (location.hostname === '127.0.0.1') localStorage.setItem('takkeu.preferences.v1', JSON.stringify({ version: 1, bestScore: best, volume: 0.65, muted: false, sensitivity: 1, quality: 'low' }));
  }, bestScore);
  await page.goto('/tests/fixtures/stage3.html?ranking=remote');
}

async function finish(page: Page, score: number) {
  await page.evaluate(value => { window.stage3.show(value); window.stage3.finish(); }, score);
  await page.clock.runFor(16);
  await expect(page.locator('[data-result-score]')).toHaveText(String(score));
}

// The gameplay fixture creates a ball for every earned reward. Exercise huge
// share values through the production screens without allocating those balls.
async function renderLargeResult(page: Page, score: number) {
  await page.evaluate(async value => {
    const snapshot = window.stage3.snapshot();
    window.stage3.dispose();
    const screensUrl = '/src/ui/screens.ts', preferencesUrl = '/src/storage/preferences.ts';
    const [{ createScreens }, { DEFAULT_PREFERENCES }] = await Promise.all([import(screensUrl), import(preferencesUrl)]);
    const screens = createScreens(document.querySelector('#app')!, {
      start() {}, pause() {}, resume() {}, retry() {}, toggleSound() {}, volume() {},
      home() { screens.render({ ...snapshot, phase: 'ready', score: 0 }); },
    });
    screens.setPreferences({ ...DEFAULT_PREFERENCES, bestScore: value });
    screens.render({ ...snapshot, phase: 'gameover', score: value });
  }, score);
}

test('自己ベストなしのホームから通常リンクで正式URLと汎用文を開ける', async ({ page, context }) => {
  const intents = await blockX(context);
  await page.goto('/');
  const home = page.getByRole('link', { name: 'Xでシェア', exact: true });
  await expect(page.locator('.home-footer')).toContainText('Xでシェア');
  await page.getByRole('button', { name: 'はじめる', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(home).toBeFocused();
  await activateIntent(page, home, genericText, true);
  await activateIntent(page, home, genericText);
  expect(intents).toHaveLength(2);
});

test('自己ベストと今回の結果を区別し、通信失敗・再挑戦・0点・大きな値・ホームでも共有値を保つ', async ({ page, context }) => {
  const intents = await blockX(context);
  await page.route('https://*.supabase.co/rest/v1/rpc/get_best_score_ranking', route => route.fulfill({ status: 503, json: { code: 'unavailable' } }));
  await openHarness(page, 200);
  const home = page.locator('[data-share-home-x]'), result = page.locator('[data-share-x]');
  const bestText = '卓球ゲーム「タッケウ」で自己ベスト200ラリー！\n何ラリーつなげられる？ #タッケウ';
  await activateIntent(page, home, bestText);
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await expect(result).not.toHaveAttribute('href');
  await finish(page, 37);
  await expect(page.locator('[data-result] [data-best]')).toHaveText('200');
  await expect(page.locator('[data-ranking-message]')).toContainText('取得できません');
  await page.getByRole('button', { name: 'もう一度', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(result).toBeFocused();
  await activateIntent(page, result, 'タッケウで37ラリー達成！\n何ラリーつなげられる？ #タッケウ', true);
  await page.getByRole('button', { name: 'もう一度', exact: true }).click();
  await page.clock.runFor(16);
  await expect(result).not.toHaveAttribute('href');
  await finish(page, 0);
  await activateIntent(page, result, 'タッケウで0ラリー達成！\n何ラリーつなげられる？ #タッケウ');
  await page.locator('[data-result] [data-action="home"]').click();
  await expect(result).not.toHaveAttribute('href');
  await expectIntent(home, bestText);
  await renderLargeResult(page, 1234567890);
  await activateIntent(page, result, 'タッケウで1234567890ラリー達成！\n何ラリーつなげられる？ #タッケウ');
  await page.locator('[data-result] [data-action="home"]').click();
  await expectIntent(home, '卓球ゲーム「タッケウ」で自己ベスト1234567890ラリー！\n何ラリーつなげられる？ #タッケウ');
  expect(intents).toHaveLength(4);
});

for (const [width, height] of [[320, 568], [568, 320], [1280, 720]] as const) {
  for (const textScale of [1, 2]) {
    test(`共有リンクは${width}x${height}・文字${textScale * 100}%でも読めて操作できる`, async ({ page, context }, info) => {
      await page.setViewportSize({ width, height });
      const intents = await blockX(context);
      await openHarness(page, 1234567890);
      await page.addStyleTag({ content: `:root { font-size: ${16 * textScale}px; }` });
      const home = page.locator('[data-share-home-x]');
      await home.scrollIntoViewIfNeeded();
      await expect(home).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      const overlaps = await page.locator('.home-footer').evaluate(footer => {
        const boxes = [...footer.children].map(node => node.getBoundingClientRect());
        return boxes.some((a, i) => boxes.slice(i + 1).some(b => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1));
      });
      expect(overlaps).toBe(false);
      await page.screenshot({ path: info.outputPath(`home-${width}x${height}-${textScale}.png`) });
      await activateIntent(page, home, '卓球ゲーム「タッケウ」で自己ベスト1234567890ラリー！\n何ラリーつなげられる？ #タッケウ');
      await renderLargeResult(page, 1234567890);
      const result = page.locator('[data-share-x]');
      await result.scrollIntoViewIfNeeded();
      await expect(result).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      const bounds = await result.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      await page.screenshot({ path: info.outputPath(`result-${width}x${height}-${textScale}.png`) });
      await activateIntent(page, result, 'タッケウで1234567890ラリー達成！\n何ラリーつなげられる？ #タッケウ');
      expect(intents).toHaveLength(2);
    });
  }
}
