import { expect, test } from '../helpers/browserTest';
import type {} from '../helpers/appHarness';

test.beforeEach(async ({ page }) => {
  const now = new Date('2026-10-22T13:00:00Z');
  await page.clock.install({ time: now }); await page.clock.pauseAt(new Date(now.getTime() + 1000));
  await page.goto('/tests/fixtures/stage3.html');
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
});

test('通常の指離れ・2本目・追跡喪失・回転で入力が残らない', async ({ page }, testInfo) => {
  const surface = page.getByTestId('input-surface');
  const down = { pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, clientX: 120, clientY: 300 };
  await surface.dispatchEvent('pointerdown', down);
  await surface.dispatchEvent('pointermove', { ...down, clientX: 145, clientY: 290 });
  await page.clock.runFor(100);
  await surface.dispatchEvent('pointerdown', { ...down, pointerId: 2 });
  await surface.dispatchEvent('pointermove', { ...down, pointerId: 2, clientX: 700 });
  await surface.dispatchEvent('pointerup', down);
  await surface.dispatchEvent('lostpointercapture', down);
  const released = await page.evaluate(() => window.stage3.snapshot());
  await page.clock.runFor(100);
  expect(await page.evaluate(() => window.stage3.snapshot().paddle)).toEqual(released.paddle);
  expect(released.phase).toBe('running');
  // The extra finger cannot inherit ownership; lift it before a new gesture.
  await surface.dispatchEvent('pointerup', { ...down, pointerId: 2 });
  await surface.dispatchEvent('pointerdown', down);
  await surface.dispatchEvent('lostpointercapture', down);
  await expect(page.getByRole('heading', { name: 'ひと休み' })).toBeVisible();
  const held = await page.evaluate(() => window.stage3.snapshot());
  await page.setViewportSize({ width: 844, height: 390 }); await page.clock.runFor(5000);
  expect(await page.evaluate(() => window.stage3.snapshot().paddle)).toEqual(held.paddle);
  expect(await page.evaluate(() => window.stage3.snapshot().simTime)).toBe(held.simTime);
  await page.screenshot({ path: testInfo.outputPath('rotated-paused.png') });
  await page.getByRole('button', { name: 'つづける', exact: true }).click();
  await surface.dispatchEvent('pointermove', { ...down, clientX: 800 });
  await page.clock.runFor(50);
  expect(await page.evaluate(() => window.stage3.snapshot().paddle)).toEqual(held.paddle);
});

test('非表示・画面ロック相当のpagehideでM10・球・時刻が止まり、手動で再開', async ({ page }) => {
  await page.evaluate(() => window.stage3.show(10)); await page.clock.runFor(32);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  const before = await page.evaluate(() => window.stage3.snapshot());
  await page.clock.runFor(10_000);
  expect(await page.evaluate(() => window.stage3.snapshot())).toEqual(before);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pageshow')); });
  await page.clock.runFor(500);
  expect(await page.evaluate(() => window.stage3.snapshot())).toEqual(before);
  await page.getByRole('button', { name: 'つづける', exact: true }).click(); await page.clock.runFor(32);
  const resumedTime = await page.evaluate(() => window.stage3.snapshot().simTime);
  expect(resumedTime).toBeGreaterThan(before.simTime);
  expect(resumedTime - before.simTime).toBeLessThanOrEqual(0.04);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  expect(await page.evaluate(() => window.stage3.snapshot().phase)).toBe('paused');
});

test('WebGL復旧で描画を再作成し、停止中の390・スマッシュ予告を保持する', async ({ page }, testInfo) => {
  await page.evaluate(() => window.stage3.show(450)); await page.clock.runFor(32);
  await expect(page.getByText('スマッシュがくる！', { exact: true })).toBeVisible();
  await page.locator('canvas').dispatchEvent('webglcontextlost', { cancelable: true });
  await expect(page.getByRole('button', { name: 'つづける', exact: true })).toBeDisabled();
  const before = await page.evaluate(() => window.stage3.snapshot());
  await page.clock.runFor(5000); expect(await page.evaluate(() => window.stage3.snapshot())).toEqual(before);
  await page.evaluate(() => window.stage3.restore());
  await expect(page.getByRole('button', { name: 'つづける', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => window.stage3.metrics().viewCreates)).toBe(2);
  expect(await page.evaluate(() => window.stage3.metrics().viewDisposes)).toBe(1);
  expect(await page.evaluate(() => window.stage3.snapshot())).toEqual(before);
  await expect(page.getByText('スマッシュがくる！', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('context-restored-warning.png') });
  await page.getByRole('button', { name: 'つづける', exact: true }).click(); await page.clock.runFor(64);
  expect(await page.evaluate(() => window.stage3.snapshot().simTime)).toBeGreaterThan(before.simTime);
});

test('実際のWEBGL_lose_contextによる喪失と復旧でも手動再開を待つ', async ({ page }, info) => {
  await page.evaluate(() => window.stage3.show(450)); await page.clock.runFor(32);
  const supported = await page.evaluate(() => {
    const ext = document.querySelector('canvas')!.getContext('webgl2')!.getExtension('WEBGL_lose_context');
    Object.assign(window, { nativeContextLoss: ext }); ext?.loseContext(); return !!ext;
  });
  expect(supported, 'このブラウザの実コンテキスト喪失検証に必要な拡張').toBe(true);
  await expect(page.getByRole('button', { name: 'つづける', exact: true })).toBeDisabled();
  const before = await page.evaluate(() => window.stage3.snapshot());
  await page.evaluate(() => (window as unknown as { nativeContextLoss: WEBGL_lose_context }).nativeContextLoss.restoreContext());
  await expect(page.getByRole('button', { name: 'つづける', exact: true })).toBeEnabled();
  await page.clock.runFor(2000); expect(await page.evaluate(() => window.stage3.snapshot())).toEqual(before);
  await expect(page.getByText('スマッシュがくる！', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('native-webgl-restored.png') });
  await page.getByRole('button', { name: 'つづける', exact: true }).click(); await page.clock.runFor(64);
  expect(await page.evaluate(() => window.stage3.snapshot().simTime)).toBeGreaterThan(before.simTime);
});

test('描画再作成の失敗時も状態を壊さずホームへ戻れる', async ({ page }) => {
  await page.evaluate(() => window.stage3.show(450)); await page.clock.runFor(32);
  await page.locator('canvas').dispatchEvent('webglcontextlost', { cancelable: true });
  const before = await page.evaluate(() => window.stage3.snapshot());
  await page.evaluate(() => { window.stage3.failNextView(); window.stage3.restore(); });
  await expect(page.getByRole('alert')).toContainText('描画を復旧できませんでした');
  expect(await page.evaluate(() => window.stage3.snapshot())).toEqual(before);
  await expect(page.getByRole('button', { name: 'つづける', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'ホームへ', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'タッケウ', exact: true })).toBeVisible();
});
