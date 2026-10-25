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

test('結果電撃の実フレームを記録し、5本上限と継続発生を確認する', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/tests/fixtures/result.html'); await page.evaluate(() => window.resultHarness.show(2000));
  const result = await page.evaluate(() => new Promise<{ frames: number; p95Ms: number; maxBolts: number; shapes: number; colors: string[]; intervals: number[] }>(resolve => {
    const intervals: number[] = [], shapes = new Set<string>(), colors = new Set<string>();
    let previous = performance.now(), start = previous, maxBolts = 0;
    function frame(now: number) {
      intervals.push(now - previous); previous = now;
      const bolts = [...document.querySelectorAll('[data-bolt]')]; maxBolts = Math.max(maxBolts, bolts.length);
      for (const bolt of bolts) { colors.add(bolt.getAttribute('data-bolt')!); shapes.add(bolt.querySelector('path')?.getAttribute('d') ?? ''); }
      if (now - start < 5000) { requestAnimationFrame(frame); return; }
      const sorted = [...intervals].sort((a,b) => a-b);
      resolve({ frames: intervals.length, p95Ms: sorted[Math.ceil(sorted.length * .95)-1]!, maxBolts, shapes: shapes.size, colors: [...colors].sort(), intervals });
    }
    requestAnimationFrame(frame);
  }));
  expect(result.maxBolts).toBeLessThanOrEqual(5); expect(result.shapes).toBeGreaterThan(20); expect(result.colors).toEqual(['blue','green','red']); expect(errors).toEqual([]);
  await info.attach('result-animation-performance', { body: JSON.stringify({ environment: 'Linux Playwright reference; not iPhone hardware acceptance', ...result }), contentType: 'application/json' });
});
