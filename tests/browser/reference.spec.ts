import { expect, test } from '../helpers/browserTest';

test('viewport全体の実描画でPC・縦・横の台を最大限収める', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.home-art img')).toBeVisible();
  expect(await page.locator('.home-art img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await page.goto('/tests/fixtures/stage2.html');
  await page.waitForFunction(() => !!window.stage2);
  const results = [];
  for (const [width, height] of [[1280, 720], [390, 844], [874, 402]]) {
    await page.setViewportSize({ width: width!, height: height! });
    await page.evaluate(() => window.stage2.show(0));
    const canvas = page.locator('canvas');
    const metrics = await page.evaluate(async () => {
      const url = '/src/render/camera.ts'; const { createCamera, fitCamera } = await import(url);
      const configUrl = '/src/game/config.ts'; const { DEFAULT_CONFIG: config } = await import(configUrl);
      const rect = document.querySelector('canvas')!.getBoundingClientRect();
      const camera = createCamera(); fitCamera(camera, rect.width, rect.height, config);
      const project = (x: number, z: number) => {
        const p = camera.position.clone().set(x, 0, z).project(camera);
        return { x: (p.x + 1) * rect.width / 2, y: (1 - p.y) * rect.height / 2 };
      };
      const fl = project(-1, 1.8), fr = project(1, 1.8), bl = project(-1, -1.8), br = project(1, -1.8);
      return { width: rect.width, height: rect.height, frontFraction: (fr.x - fl.x) / rect.width,
        perspective: (fr.x - fl.x) / (br.x - bl.x), depthFraction: (fl.y - bl.y) / (fr.x - fl.x),
        noOverflow: document.documentElement.scrollWidth <= innerWidth, corners: { fl, fr, bl, br } };
    });
    expect(metrics.width).toBe(width); expect(metrics.height).toBe(height);
    expect(metrics.frontFraction * metrics.width).toBeGreaterThan(Math.min(width!, height! * 225 / 157) * .8);
    expect(metrics.perspective).toBeGreaterThan(2.5);
    expect(metrics.depthFraction).toBeLessThan(0.49);
    expect(metrics.noOverflow).toBe(true);
    await expect(page.locator('.game-header, .input-pad, .game-hint')).toHaveCount(0);
    await expect(page.locator('canvas')).toBeFocused();
    await canvas.screenshot({ path: info.outputPath(`court-${width}x${height}.png`) });
    await page.screenshot({ path: info.outputPath(`screen-${width}x${height}.png`) });
    results.push({ viewport: { width, height }, ...metrics });
  }
  await info.attach('reference-framing.json', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
  expect(errors).toEqual([]);
});
