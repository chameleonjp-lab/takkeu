import { expect, test, waitForStart } from '../helpers/browserTest';
import type {} from '../helpers/appHarness';

test('99落球では継続し100球目で残球があっても結果へ進み再挑戦で0に戻る', async ({ page }, info) => {
  await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/tests/fixtures/stage3.html');
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await waitForStart(page);
  await page.evaluate(() => window.stage3.lossLimit());
  await page.clock.runFor(40);
  await expect(page.getByLabel('落球数', { exact: true })).toHaveText('99 / 100');
  expect(await page.evaluate(() => window.stage3.snapshot().phase)).toBe('running');
  await page.keyboard.press('Escape');
  const paused = await page.evaluate(() => window.stage3.snapshot());
  await page.clock.runFor(1000);
  expect(await page.evaluate(() => window.stage3.snapshot())).toEqual(paused);
  await page.getByRole('button', { name: 'つづける', exact: true }).click();
  await page.clock.runFor(80);
  const ended = await page.evaluate(() => window.stage3.snapshot());
  expect(ended.phase).toBe('gameover'); expect(ended.lostBallCount).toBe(100);
  expect(ended.balls).toHaveLength(1);
  await expect(page.locator('[data-result]')).toBeHidden();
  await expect(page.locator('[data-finishing]')).toBeVisible();
  await expect(page.getByLabel('落球数', { exact: true })).toHaveText('100 / 100');
  await page.screenshot({ path: info.outputPath('hundred-loss-final-animation.png') });
  await page.clock.runFor(2100);
  // The terminal100 marker owns its two-second lifetime;99 must not return.
  await expect(page.locator('[data-finishing]')).toBeHidden();
  expect(await page.evaluate(() => window.stage3.snapshot())).toEqual(ended);
  await page.clock.runFor(1100);
  await expect(page.locator('[data-result-score]')).toHaveText('340');
  await expect(page.locator('[data-loss-limit-message]')).toBeVisible();
  await expect(page.locator('[data-status]')).toContainText('100球');
  await expect(page.locator('[data-status]')).toContainText('残球数1');
  const events = await page.evaluate(() => window.stage3.metrics().events);
  expect(events.filter(e => e.kind === 'game-over')).toHaveLength(1);
  await page.clock.runFor(1000);
  expect(await page.evaluate(() => window.stage3.snapshot())).toEqual(ended);
  await page.screenshot({ path: info.outputPath('hundred-loss-result.png') });
  await page.getByRole('button', { name: 'もう一度', exact: true }).click();
  await waitForStart(page);
  await page.clock.runFor(16);
  await expect(page.getByLabel('落球数', { exact: true })).toHaveText('0 / 100');
  await expect(page.getByLabel('残球数', { exact: true })).toHaveText('1');
  expect(await page.evaluate(() => window.stage3.snapshot().runId)).not.toBe(ended.runId);
  await expect(page.locator('[data-loss-limit-message]')).toBeHidden();
});

test('狭い画面でもラリー・残球・落球数が重ならず表示される', async ({ page }, info) => {
  await page.setViewportSize({ width: 280, height: 360 });
  await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/tests/fixtures/stage3.html');
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await waitForStart(page);
  await page.evaluate(() => window.stage3.lossLimit()); await page.clock.runFor(40);
  await expect(page.getByLabel('落球数', { exact: true })).toHaveText('99 / 100');
  const boxes = await page.locator('.hud > div').evaluateAll(nodes => nodes.map(node => {
    const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  }));
  for (let i = 0; i < boxes.length; i++) {
    const a = boxes[i]!; expect(a.left).toBeGreaterThanOrEqual(0); expect(a.right).toBeLessThanOrEqual(280);
    for (const b of boxes.slice(i + 1)) expect(Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)).toBe(false);
  }
  await page.screenshot({ path: info.outputPath('hundred-loss-small-hud.png') });
});
