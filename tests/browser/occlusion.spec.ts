import { expect, test } from '@playwright/test';

test('球と虹色の輪郭はラケットとの前後関係を守る', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 660, height: 460 });
  await page.goto('/tests/fixtures/occlusion.html');
  await page.waitForFunction(() => !!window.occlusion);
  const results = [];
  for (const score of [0, 10, 30, 390]) {
    const pixels = await page.evaluate(score => ({
      score, absent: window.occlusion.show('absent', score), behind: window.occlusion.show('behind', score),
      front: window.occlusion.show('front', score),
    }), score);
    results.push(pixels);
    await page.evaluate(score => window.occlusion.show('behind', score), score);
    await page.locator('canvas').screenshot({ path: testInfo.outputPath(`behind-${score}.png`), scale: 'css' });
    await page.evaluate(score => window.occlusion.show('front', score), score);
    await page.locator('canvas').screenshot({ path: testInfo.outputPath(`front-${score}.png`), scale: 'css' });
    expect(pixels.behind, '奥の球・発光がラバー面を透過しない').toEqual(pixels.absent);
    expect(pixels.front, '手前へ来た球は表示する').not.toEqual(pixels.absent);
    if (score >= 10) {
      const rgb = pixels.front.slice(0, 3);
      expect(Math.min(...rgb), '虹色の球の中心は明るい白を保つ').toBeGreaterThan(200);
      expect(Math.max(...rgb) - Math.min(...rgb)).toBeLessThan(15);
    }
  }
  await testInfo.attach('gpu-occlusion', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
});
