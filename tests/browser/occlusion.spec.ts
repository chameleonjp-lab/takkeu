import { expect, test } from '@playwright/test';

test('球が前後に混在しても、ネットより手前の虹色の輪郭がネットに透けない',async({page},info)=>{
  await page.goto('/tests/fixtures/occlusion.html');await page.waitForFunction(()=>!!window.occlusion);
  const pixels=await page.evaluate(()=>window.occlusion.netGlowProbe());
  await info.attach('net-glow-depth.json',{body:JSON.stringify(pixels),contentType:'application/json'});
  expect(pixels.front[0]!).toBeGreaterThan(pixels.behind[0]!+50);
});

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


test('虹色は照明がなくても発光し、相手床・壁は閾値まで暗い', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/tests/fixtures/occlusion.html');
  await page.waitForFunction(() => !!window.occlusion);
  const results = await page.evaluate(() => window.occlusion.emissionProbe());
  for (const row of results) {
    expect(row.x).toBeGreaterThan(0); expect(row.x).toBeLessThan(600);
    expect(row.y).toBeGreaterThan(0); expect(row.y).toBeLessThan(419);
    expect(Math.max(...row.pixels[0]!.slice(0, 3)), `${row.id} before`).toBeLessThan(8);
    expect(Math.max(...row.pixels[1]!.slice(0, 3)), `${row.id} emitted light`).toBeGreaterThan(150);
    for (let i = 0; i < row.captures.length; i++) await info.attach(`${row.id}-${i ? 'glowing' : 'before'}`, { body: Buffer.from(row.captures[i]!.split(',')[1]!, 'base64'), contentType: 'image/png' });
  }
  await info.attach('emission-pixels.json', { body: JSON.stringify(results.map(({ captures: _, ...row }) => row), null, 2), contentType: 'application/json' });
  expect(errors).toEqual([]);
});
