import { expect, test } from '@playwright/test';

test.use({ video: 'on' });
const scores = [0, 5, 10, 30, 50, 70, 100, 130, 150, 160, 190, 210, 240, 270, 300, 330, 360, 390, 420, 450];

test('専用状態で全19行の表示と発光終了を撮影する', async ({ page }, info) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/tests/fixtures/stage2.html');
  await page.waitForFunction(() => !!window.stage2);
  for (const score of scores) {
    await page.evaluate(score => window.stage2.show(score, 0, score === 10 ? 5 : null), score);
    await expect(page.getByLabel('ラリー数', { exact: true })).toHaveText(String(score));
    const parts = await page.evaluate(() => window.stage2.presentation());
    expect(parts.opponentEdgesVisible).toBe(true);
    expect(parts.parts.courtEdges.rainbow).toBe(score >= 70);
    expect(parts.parts.opponentCourtRight.visible).toBe(true);
    expect(parts.parts.opponentCourtRight.rainbow).toBe(score >= 190);
    expect(parts.parts.opponentCourtLeft.visible).toBe(true);
    expect(parts.parts.opponentCourtLeft.rainbow).toBe(score >= 240);
    expect(parts.parts.opponentRacketBody.visible).toBe(true);
    expect(parts.parts.opponentRacketBody.rainbow).toBe(score >= 330);
    expect(parts.parts.opponentBody.visible).toBe(score >= 360);
    await page.screenshot({ path: info.outputPath(`milestone-${String(score).padStart(3, '0')}.png`) });
  }
  await page.evaluate(() => window.stage2.show(10, 5, 5));
  expect((await page.evaluate(() => window.stage2.presentation())).balls[1]!.visible).toBe(false);
  await page.screenshot({ path: info.outputPath('milestone-010-ended.png') });
  expect(errors).toEqual([]);
});

test('390の強弱を実描画で比較し、0.6秒の動きを保存する', async ({ page }, info) => {
  await page.goto('/tests/fixtures/stage2.html');
  await page.waitForFunction(() => !!window.stage2);
  await page.evaluate(() => window.stage2.show(390));
  const strong = await page.locator('canvas').screenshot();
  await page.evaluate(() => window.stage2.time(0.3));
  const weak = await page.locator('canvas').screenshot();
  expect(strong.equals(weak)).toBe(false);
  await page.evaluate(() => window.stage2.time(0.6));
  const fullCycle = await page.locator('canvas').screenshot();
  expect(weak.equals(fullCycle)).toBe(false);
  await info.attach('pulse-strong', { body: strong, contentType: 'image/png' });
  await info.attach('pulse-weak', { body: weak, contentType: 'image/png' });
  await page.evaluate(() => window.stage2.show(390, 0));
  await page.evaluate(() => window.stage2.animate(1.8));
  await expect(page.getByLabel('ラリー数', { exact: true })).toHaveText('390');
});
