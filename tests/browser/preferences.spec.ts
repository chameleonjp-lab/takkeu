import { expect, test } from '@playwright/test';

test('全設定と自己ベストが再読込・リトライを越えて残る', async ({ page }, testInfo) => {
  await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/');
  await expect(page.locator('[data-home]').getByLabel('自己ベスト', { exact: true })).toHaveText('0');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByLabel('効果音の音量', { exact: true }).fill('0.3');
  await page.getByLabel('操作感度', { exact: true }).fill('1.6');
  await page.getByLabel('描画品質', { exact: true }).selectOption('low');
  await page.getByRole('button', { name: '音：オン', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('settings.png'), fullPage: true });
  await page.getByRole('button', { name: '戻る', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await expect(page.getByLabel('効果音の音量', { exact: true })).toHaveValue('0.3');
  await expect(page.getByLabel('操作感度', { exact: true })).toHaveValue('1.6');
  await expect(page.getByLabel('描画品質', { exact: true })).toHaveValue('low');
  await expect(page.getByRole('button', { name: '音：オフ', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '戻る', exact: true }).click();
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await page.clock.runFor(2700);
  await expect(page.getByLabel('ラリー数', { exact: true })).toHaveText('1');
  await page.getByRole('button', { name: '一時停止', exact: true }).click();
  await page.getByRole('button', { name: '最初からやり直す', exact: true }).click();
  await expect(page.getByLabel('ラリー数', { exact: true })).toHaveText('0');
  await page.getByRole('button', { name: '一時停止', exact: true }).click();
  await page.getByRole('button', { name: 'ホームへ', exact: true }).click();
  await page.reload();
  await expect(page.locator('[data-home]').getByLabel('自己ベスト', { exact: true })).toHaveText('1');
});

test('保存拒否でも設定と自己ベストをメモリに保持して遊べる', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('denied'); };
    Storage.prototype.setItem = () => { throw new Error('quota'); };
  });
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByLabel('操作感度', { exact: true }).fill('1.4');
  await expect(page.getByText('この端末に保存できません。開いている間は設定と自己ベストを保持します。')).toBeVisible();
  await page.getByRole('button', { name: '戻る', exact: true }).click();
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await expect(page.getByRole('button', { name: '一時停止', exact: true })).toBeVisible();
});
