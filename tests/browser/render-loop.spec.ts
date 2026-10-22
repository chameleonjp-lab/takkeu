import { expect, test } from '@playwright/test';
import type {} from '../helpers/appHarness';

test('停止・終了中は同じ3D画面を繰り返し描かず、回転と再開時には描画する', async ({ page }) => {
  const now = new Date('2026-10-22T16:00:00Z');
  await page.clock.install({ time: now }); await page.clock.pauseAt(new Date(+now + 1000));
  await page.goto('/tests/fixtures/stage3.html');
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await page.clock.runFor(100);
  await page.getByRole('button', { name: '一時停止', exact: true }).click();
  const before = await page.evaluate(() => ({ count: window.stage3.metrics().viewRenders, state: window.stage3.snapshot() }));
  await page.clock.runFor(500);
  expect(await page.evaluate(() => window.stage3.metrics().viewRenders)).toBe(before.count);
  expect(await page.evaluate(() => window.stage3.snapshot())).toEqual(before.state);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.clock.runFor(32);
  const resized = await page.evaluate(() => window.stage3.metrics().viewRenders);
  expect(resized).toBeGreaterThan(before.count);
  await page.clock.runFor(500);
  expect(await page.evaluate(() => window.stage3.metrics().viewRenders)).toBe(resized);
  await page.getByRole('button', { name: 'つづける', exact: true }).click();
  await page.clock.runFor(100);
  expect(await page.evaluate(() => window.stage3.metrics().viewRenders)).toBeGreaterThan(resized);
  await page.evaluate(() => window.stage3.finish()); await page.clock.runFor(32);
  const finished = await page.evaluate(() => window.stage3.metrics().viewRenders);
  await page.clock.runFor(500);
  expect(await page.evaluate(() => window.stage3.metrics().viewRenders)).toBe(finished);
});
