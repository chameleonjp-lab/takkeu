import { expect, test, waitForStart } from '../helpers/browserTest';
import type {} from '../helpers/appHarness';

test('前の賞状の共有失敗を再挑戦後の結果へ表示しない', async ({ page }) => {
  await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/tests/fixtures/stage3.html');
  await page.evaluate(() => {
    const w = window as typeof window & { rejectOldShare?: () => void };
    Object.defineProperties(navigator, {
      canShare: { configurable: true, value: () => true },
      share: { configurable: true, value: () => new Promise<void>((_resolve, reject) => { w.rejectOldShare = () => reject(new Error('old share failed')); }) },
    });
  });
  await page.getByRole('button', { name: 'はじめる', exact: true }).click(); await waitForStart(page);
  await page.evaluate(() => window.stage3.goal()); await page.clock.runFor(3200);
  await page.locator('[data-certificate-create]').click(); await expect(page.locator('[data-certificate-share]')).toBeVisible();
  await page.locator('[data-certificate-share]').click();
  await page.getByRole('button', { name: 'もう一度', exact: true }).click(); await waitForStart(page);
  await page.evaluate(() => window.stage3.goal()); await page.clock.runFor(3200);
  await expect(page.locator('[data-certificate-message]')).toHaveText('');
  await page.evaluate(() => (window as typeof window & { rejectOldShare?: () => void }).rejectOldShare?.());
  await page.clock.runFor(32);
  await expect(page.locator('[data-certificate-message]')).toHaveText('');
});
