import { test, expect } from '../helpers/browserTest';
import { resultBands } from '../helpers/resultCases';
import type {} from '../helpers/resultHarness';

test('全44コメントは320px幅でも2行以内、順位まで見え横スクロールしない', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/tests/fixtures/result.html');
  const measurements: unknown[] = [];
  for (const width of [320, 402]) {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 874 });
    for (const [min, max, text] of resultBands) {
      await page.evaluate(score => { window.resultHarness.show(score); window.resultHarness.position({ status: 'loaded', rank: 123, total: 250, bestScore: 2000 }); }, min);
      await expect(page.locator('[data-result] h2')).toHaveText(text);
      const measure = await page.evaluate(() => {
        const heading = document.querySelector<HTMLElement>('[data-result] h2')!;
        const rank = document.querySelector<HTMLElement>('[data-result-position]')!;
        const score = document.querySelector<HTMLElement>('[data-result-score]')!;
        const style = getComputedStyle(heading), bounds = heading.getBoundingClientRect();
        return { lines: bounds.height / parseFloat(style.lineHeight), width: document.documentElement.scrollWidth, viewport: innerWidth,
          scoreLeft: score.getBoundingClientRect().left, scoreRight: score.getBoundingClientRect().right,
          rankBottom: rank.getBoundingClientRect().bottom, viewportHeight: innerHeight };
      });
      expect(measure.lines).toBeLessThanOrEqual(2.1); expect(measure.width).toBeLessThanOrEqual(measure.viewport);
      expect(measure.scoreLeft).toBeGreaterThanOrEqual(0); expect(measure.scoreRight).toBeLessThanOrEqual(width);
      expect(measure.rankBottom).toBeLessThan(measure.viewportHeight);
      measurements.push({ requestedWidth: width, min, max, ...measure });
    }
    await page.screenshot({ path: info.outputPath(`result-${width}.png`), fullPage: true });
    const buttons = await page.locator('[data-result] button, [data-share-x], [data-result] .lab-link').evaluateAll(nodes => nodes.filter(node => (node as HTMLElement).offsetHeight > 0).map(node => ({ text: node.textContent, height: node.getBoundingClientRect().height })));
    for (const button of buttons) expect(button.height, button.text ?? '').toBeGreaterThanOrEqual(44);
    await page.evaluate(() => window.resultHarness.show(100000000));
    await expect(page.getByLabel('今回のラリー数', { exact: true })).toHaveText('100000000');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // Explicitly enlarge the longest comment too: root scaling alone does not
    // enlarge this px/vw heading. Reflow may exceed two lines at accessibility sizes.
    await page.evaluate(() => {
      window.resultHarness.show(1600);
      const heading = document.querySelector<HTMLElement>('[data-result] h2')!;
      heading.style.fontSize = `${parseFloat(getComputedStyle(heading).fontSize) * 2}px`;
    });
    await expect(page.locator('[data-result] h2')).toHaveText('これは記録じゃない、事件！');
    const enlarged = await page.evaluate(() => {
      const title = document.querySelector<HTMLElement>('[data-result] h2')!.getBoundingClientRect();
      const rank = document.querySelector<HTMLElement>('[data-result-position]')!.getBoundingClientRect();
      return { viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, titleBottom: title.bottom, rankTop: rank.top };
    });
    expect(enlarged.documentWidth).toBeLessThanOrEqual(width); expect(enlarged.titleBottom).toBeLessThanOrEqual(enlarged.rankTop);
    measurements.push({ requestedWidth: width, textEnlargement: 'root font 200% + longest heading computed size x2; not hardware/browser zoom', ...enlarged });
    await page.screenshot({ path: info.outputPath(`result-enlarged-${width}.png`), fullPage: true });
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; document.querySelector<HTMLElement>('[data-result] h2')!.style.fontSize = ''; });
  }
  await info.attach('layout-measurements', { body: JSON.stringify(measurements, null, 2), contentType: 'application/json' });
});
