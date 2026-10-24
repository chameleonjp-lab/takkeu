import { expect, test } from '../helpers/browserTest';
import type {} from '../helpers/appHarness';

test.use({ viewport: { width: 390, height: 600 }, screen: { width: 390, height: 600 }, isMobile: true, hasTouch: true });

test('スマホの高さ変更をまたいで同じ指のドラッグを継続できる', async ({ page }) => {
  await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/tests/fixtures/stage3.html');
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  const canvas = page.locator('canvas');
  const finger = { pointerId: 51, pointerType: 'touch', isPrimary: true, button: 0, clientX: 140, clientY: 360 };
  await canvas.dispatchEvent('pointerdown', finger); await page.clock.runFor(25);
  const before = await page.evaluate(() => window.stage3.snapshot().paddle);
  await page.setViewportSize({ width: 390, height: 844 });
  // WebKit's native resize delivery is outside the paused virtual clock.
  // Deliver it explicitly so this checks the gesture across the actual refit.
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await page.clock.runFor(150);
  await canvas.dispatchEvent('pointermove', { ...finger, clientX: 320, clientY: 600 }); await page.clock.runFor(25);
  const after = await page.evaluate(() => window.stage3.snapshot());
  expect(after.phase).toBe('running'); expect(after.paddle.x).toBeGreaterThan(before.x + .1);
  await canvas.dispatchEvent('pointerup', { ...finger, clientX: 320, clientY: 600 }); await page.clock.runFor(25);
  expect(await page.evaluate(() => window.stage3.snapshot().paddle)).toEqual(after.paddle);
});

test('開始直後のresizeとキーボードを閉じる高さ変更ではポーズにならない', async ({ page }) => {
  const lifecycle: string[] = [];
  page.on('console', message => { if (message.text().startsWith('lifecycle:')) lifecycle.push(message.text()); });
  await page.addInitScript(() => {
    for (const type of ['resize', 'orientationchange', 'blur']) window.addEventListener(type, () => {
      console.log('lifecycle:', JSON.stringify({ type, width: innerWidth, height: innerHeight, angle: screen.orientation?.angle, coarse: matchMedia('(pointer: coarse)').matches }));
    });
  });
  await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/tests/fixtures/stage3.html');
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.runFor(500);
  expect(await page.evaluate(() => window.stage3.snapshot().phase), lifecycle.join('\n')).toBe('running');
  await expect(page.getByRole('dialog')).toBeHidden();
  const rect = await page.locator('canvas').boundingBox();
  expect(rect).toMatchObject({ x: 0, y: 0, width: 390, height: 844 });
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => window.stage3.snapshot().pauseReason)).toBe('resize');
  await page.clock.runFor(500);
  expect(await page.evaluate(() => window.stage3.snapshot().phase)).toBe('paused');
});
