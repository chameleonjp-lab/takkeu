import { expect, test } from '../helpers/browserTest';

test.use({ video: 'on' });
const scores = [0, 1, 4, 5, 9, 10, 19, 20, 21, 30, 40, 70, 100, 130, 138, 139, 140, 141, 142, 143, 150, 160, 190, 210, 240, 270, 300, 330, 360, 380, 390, 410, 420, 450];

test('専用状態で増球の境界と全演出の表示・発光終了を撮影する', async ({ page }, info) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/tests/fixtures/stage2.html');
  await page.waitForFunction(() => !!window.stage2);
  for (const score of scores) {
    await page.evaluate(score => window.stage2.show(score, 0, score === 10 ? 5 : null), score);
    await expect(page.getByLabel('ラリー数', { exact: true })).toHaveText(String(score));
    const parts = await page.evaluate(() => window.stage2.presentation());
    expect(parts.opponentEdgesVisible).toBe(score >= 70);
    expect(parts.parts.courtEdges.rainbow).toBe(score >= 70);
    expect(parts.parts.opponentCourtRight.visible).toBe(score >= 190);
    expect(parts.parts.opponentCourtRight.rainbow).toBe(score >= 190);
    expect(parts.parts.opponentCourtLeft.visible).toBe(score >= 240);
    expect(parts.parts.opponentCourtLeft.rainbow).toBe(score >= 240);
    expect(parts.parts.opponentRacketBody.visible).toBe(score >= 330);
    expect(parts.parts.opponentRacketBody.rainbow).toBe(score >= 330);
    expect(parts.parts.opponentBody.visible).toBe(score >= 360);
    expect(parts.parts.opponentFloor.visible).toBe(score >= 380);
    expect(parts.parts.opponentWall.visible).toBe(score >= 420);
    expect(parts.parts.selfFloor.rainbow).toBe(score >= 410);
    const expected = new Map([[0,1],[1,1],[4,1],[5,2],[9,2],[10,3],[19,3],[20,4],[21,4],[30,5],[40,6],
      [70,12],[100,19],[130,27],[138,29],[139,29],[140,29],[141,30],[142,30],[143,30],
      [150,30],[160,30],[190,30],[210,30],[240,30],[270,30],[300,30],[330,30],
      [360,30],[380,30],[390,30],[410,30],[420,30],[450,30]]).get(score)!;
    await expect(page.getByLabel('残球数', { exact: true })).toContainText(String(expected));
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
