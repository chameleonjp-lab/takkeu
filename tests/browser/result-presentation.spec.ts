import { test, expect } from '../helpers/browserTest';
import type {} from '../helpers/resultHarness';
test.use({ viewport: { width: 402, height: 874 } });

test('数字の全段階と継続する電撃をiPhone 17 Pro相当の画面で検証する', async ({ page }, info) => {
  await page.goto('/tests/fixtures/result.html');
  for (const [score, color, colors] of [[300,'gold',[]],[500,'gold',['green']],[800,'rainbow',['green']],[1000,'rainbow',['green','blue']],[1500,'rainbow',['green','blue','red']],[2000,'rainbow',['green','blue','red']]] as const) {
    await page.evaluate(score => window.resultHarness.show(score), score);
    await expect(page.locator('[data-result]')).toHaveAttribute('data-score-color', color);
    await expect(page.locator('[data-result-score]')).toHaveText(String(score));
    for (const bolt of colors) await expect(page.locator(`[data-bolt="${bolt}"]`).first()).toBeVisible();
    await page.screenshot({ path: info.outputPath(`score-${score}.png`), fullPage: true });
  }
  const shapes = new Set<string>(); const locations = new Set<string>();
  for (let i = 0; i < 12; i++) {
    const sample = await page.locator('[data-bolt] path').evaluateAll(paths => paths.map(path => path.getAttribute('d') ?? ''));
    sample.forEach(d => { shapes.add(d); locations.add(d.split(' L')[0]!); });
    if (i === 0 || i === 6 || i === 11) await page.screenshot({ path: info.outputPath(`lightning-frame-${i}.png`) });
    await page.waitForTimeout(85);
  }
  expect(shapes.size).toBeGreaterThan(15); expect(locations.size).toBeGreaterThan(5);
  await expect(page.locator('[data-bolt]')).not.toHaveCount(0);
  await page.evaluate(() => window.resultHarness.hide());
  await expect(page.locator('[data-bolt]')).toHaveCount(0);
  await page.evaluate(() => { window.resultHarness.show(1500); window.resultHarness.show(1500); });
  await expect(page.locator('[data-bolt="red"]').first()).toBeVisible();
  expect(await page.locator('[data-bolt]').count()).toBeLessThanOrEqual(5);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('[data-bolt]')).toHaveCount(0);
  await page.waitForTimeout(200); await expect(page.locator('[data-bolt]')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('[data-bolt="red"]').first()).toBeVisible();
  await page.evaluate(() => window.resultHarness.dispose());
  await expect(page.locator('[data-bolt]')).toHaveCount(0);
  await info.attach('animation-observations', { body: JSON.stringify({ distinctShapes: shapes.size, distinctOrigins: locations.size, viewport: '402x874, browser emulation; not real iPhone Safari' }), contentType: 'application/json' });
});
