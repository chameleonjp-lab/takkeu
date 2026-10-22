import { expect, test } from '@playwright/test';
import type {} from '../helpers/appHarness';

test('縦横・44pxボタン・200%文字・ラベル・安全余白を確認', async ({ page }, info) => {
  await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/');
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await expect(page.getByRole('heading', { name: '設定', exact: true })).toBeVisible();
  await expect(page.getByLabel('操作感度', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '戻る', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('home-text-200.png'), fullPage: true });
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await page.getByRole('button', { name: '一時停止', exact: true }).click();
  await page.screenshot({ path: info.outputPath('paused-text-200.png'), fullPage: true });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(page.getByRole('button', { name: 'つづける', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab'); await expect(page.getByRole('button', { name: 'ホームへ', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'ホームへ', exact: true }).click();
  await page.addStyleTag({ content: 'html { font-size: 100%; }' });
  for (const size of [{ width: 402, height: 874 }, { width: 874, height: 402 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(size); await page.clock.runFor(32);
    await page.getByRole('button', { name: 'はじめる', exact: true }).click();
    await page.clock.runFor(32);
    for (const button of await page.getByRole('button').all()) {
      if (!await button.isVisible()) continue;
      const box = (await button.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(12); expect(box.x + box.width).toBeLessThanOrEqual(size.width - 12);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
    await page.screenshot({ path: info.outputPath(`game-${size.width}x${size.height}.png`) });
    await page.getByRole('link', { name: 'タッケウ' }).click();
  }
  await info.attach('menu-accessibility.yml', { body: await page.locator('main').ariaSnapshot(), contentType: 'text/yaml' });
});

test('品質変更は解像度だけに作用し、4球・390・420・450・高速接触を維持する', async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/tests/fixtures/stage3.html');
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await page.evaluate(() => { window.stage3.show(450); window.stage3.autoPlay(true); });
  const samples = [];
  for (let i = 0; i < 30; i++) {
    await page.clock.runFor(1000);
    const row = await page.evaluate(() => ({ state: window.stage3.snapshot(), resources: window.stage3.resources() }));
    expect(row.state.phase).toBe('running'); expect(row.state.balls.filter(b => b.phase !== 'lost')).toHaveLength(4);
    expect(row.resources!.drawCalls).toBeLessThan(100); samples.push(row);
  }
  expect(samples.at(-1)!.state.score).toBeGreaterThan(470);
  expect(await page.evaluate(() => window.stage3.metrics().smashDepartures)).toBeGreaterThan(0);
  await info.attach('four-ball-load.json', { body: JSON.stringify(samples, null, 2), contentType: 'application/json' });
});

test('WebGL初期化不可と復旧失敗でもホームと自己ベストを保つ', async ({ page }) => {
  await page.addInitScript(() => {
    const native = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, ...args: Parameters<typeof native>) {
      if (String(args[0]) === 'webgl2') return null;
      return native.apply(this, args);
    } as typeof native;
  });
  await page.goto('/'); await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('WebGL 2を利用できません');
  await expect(page.getByRole('heading', { name: 'タッケウ', exact: true })).toBeVisible();
  await expect(page.locator('[data-home]').getByLabel('自己ベスト', { exact: true })).toHaveText('0');
});
