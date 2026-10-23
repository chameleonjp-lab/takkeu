import { expect, test } from '@playwright/test';
import { GLOW_SCHEDULE } from '../helpers/glowSchedule';

test('指定された発光ラリーの直前・到達時を同一画角で撮影する', async ({ page }, info) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/tests/fixtures/stage2.html');
  await page.waitForFunction(() => !!window.stage2);
  const rows = [];
  for (const [threshold, part] of GLOW_SCHEDULE) {
    const images: Buffer[] = [];
    for (const score of [threshold - 1, threshold]) {
      await page.evaluate(score => window.stage2.show(score, 0), score);
      await expect(page.getByLabel('ラリー数', { exact: true })).toHaveText(String(score));
      const state = await page.evaluate(part => window.stage2.presentation().parts[part], part);
      expect(state.rainbow).toBe(part === 'playerRacketBody' ? score >= 390 : score >= threshold);
      if (threshold === 270) expect(!!state.solid).toBe(score >= 270);
      images.push(await page.locator('canvas').screenshot({ path: info.outputPath(`glow-${threshold}-${score}.png`) }));
      rows.push({ score, part, state });
    }
    expect(images[0]!.equals(images[1]!)).toBe(false);
  }
  await info.attach('glow-boundaries.json', { body: JSON.stringify(rows, null, 2), contentType: 'application/json' });
  expect(errors).toEqual([]);
});
