# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: occlusion.spec.ts >> 虹色は照明がなくても発光し、相手床・壁は閾値まで暗い
- Location: tests/browser/occlusion.spec.ts:30:1

# Error details

```
Error: expect(received).toBeLessThan(expected)

Expected: < 419
Received:   451
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | 
  3  | test('球と虹色の輪郭はラケットとの前後関係を守る', async ({ page }, testInfo) => {
  4  |   await page.setViewportSize({ width: 660, height: 460 });
  5  |   await page.goto('/tests/fixtures/occlusion.html');
  6  |   await page.waitForFunction(() => !!window.occlusion);
  7  |   const results = [];
  8  |   for (const score of [0, 10, 30, 390]) {
  9  |     const pixels = await page.evaluate(score => ({
  10 |       score, absent: window.occlusion.show('absent', score), behind: window.occlusion.show('behind', score),
  11 |       front: window.occlusion.show('front', score),
  12 |     }), score);
  13 |     results.push(pixels);
  14 |     await page.evaluate(score => window.occlusion.show('behind', score), score);
  15 |     await page.locator('canvas').screenshot({ path: testInfo.outputPath(`behind-${score}.png`), scale: 'css' });
  16 |     await page.evaluate(score => window.occlusion.show('front', score), score);
  17 |     await page.locator('canvas').screenshot({ path: testInfo.outputPath(`front-${score}.png`), scale: 'css' });
  18 |     expect(pixels.behind, '奥の球・発光がラバー面を透過しない').toEqual(pixels.absent);
  19 |     expect(pixels.front, '手前へ来た球は表示する').not.toEqual(pixels.absent);
  20 |     if (score >= 10) {
  21 |       const rgb = pixels.front.slice(0, 3);
  22 |       expect(Math.min(...rgb), '虹色の球の中心は明るい白を保つ').toBeGreaterThan(200);
  23 |       expect(Math.max(...rgb) - Math.min(...rgb)).toBeLessThan(15);
  24 |     }
  25 |   }
  26 |   await testInfo.attach('gpu-occlusion', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
  27 | });
  28 | 
  29 | 
  30 | test('虹色は照明がなくても発光し、相手床・壁は閾値まで暗い', async ({ page }, info) => {
  31 |   const errors: string[] = [];
  32 |   page.on('pageerror', e => errors.push(e.message));
  33 |   page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  34 |   await page.goto('/tests/fixtures/occlusion.html');
  35 |   await page.waitForFunction(() => !!window.occlusion);
  36 |   const results = await page.evaluate(() => window.occlusion.emissionProbe());
  37 |   for (const row of results) {
  38 |     expect(row.x).toBeGreaterThan(0); expect(row.x).toBeLessThan(600);
> 39 |     expect(row.y).toBeGreaterThan(0); expect(row.y).toBeLessThan(419);
     |                                                     ^ Error: expect(received).toBeLessThan(expected)
  40 |     expect(Math.max(...row.pixels[0]!.slice(0, 3)), `${row.id} before`).toBeLessThan(8);
  41 |     expect(Math.max(...row.pixels[1]!.slice(0, 3)), `${row.id} emitted light`).toBeGreaterThan(150);
  42 |     for (let i = 0; i < row.captures.length; i++) await info.attach(`${row.id}-${i ? 'glowing' : 'before'}`, { body: Buffer.from(row.captures[i]!.split(',')[1]!, 'base64'), contentType: 'image/png' });
  43 |   }
  44 |   await info.attach('emission-pixels.json', { body: JSON.stringify(results.map(({ captures: _, ...row }) => row), null, 2), contentType: 'application/json' });
  45 |   expect(errors).toEqual([]);
  46 | });
  47 | 
```