import { expect, test, waitForStart } from '../helpers/browserTest';
import { DEFAULT_PREFERENCES, PREFERENCES_KEY } from '../../src/storage/preferences';

test('全設定と自己ベストが再読込・リトライを越えて残る', async ({ page }, testInfo) => {
  await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.addInitScript(({ key, legacy }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(legacy));
  }, { key: PREFERENCES_KEY, legacy: { ...DEFAULT_PREFERENCES, sensitivity: 1.6 } });
  await page.goto('/');
  const settings = page.locator('[data-settings]');
  await expect(page.locator('[data-home]').getByLabel('自己ベスト', { exact: true })).toHaveText('0');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await settings.getByLabel('効果音の音量', { exact: true }).fill('0.3');
  await expect(page.getByLabel('操作感度', { exact: true })).toHaveCount(0);
  await page.getByLabel('描画品質', { exact: true }).selectOption('low');
  await page.getByRole('button', { name: '音：オン', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('settings.png'), fullPage: true });
  await page.getByRole('button', { name: '戻る', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await expect(settings.getByLabel('効果音の音量', { exact: true })).toHaveValue('0.3');
  await expect(page.getByLabel('操作感度', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).sensitivity, PREFERENCES_KEY)).toBe(1.6);
  await expect(page.getByLabel('描画品質', { exact: true })).toHaveValue('low');
  await expect(page.getByRole('button', { name: '音：オフ', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '戻る', exact: true }).click();
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await waitForStart(page);
  await page.clock.runFor(2700);
  await expect(page.getByLabel('ラリー数', { exact: true })).toHaveText('1');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '最初からやり直す', exact: true }).click();
  await waitForStart(page);
  await expect(page.getByLabel('ラリー数', { exact: true })).toHaveText('0');
  await page.keyboard.press('Escape');
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
  const settings = page.locator('[data-settings]');
  await expect(page.getByLabel('操作感度', { exact: true })).toHaveCount(0);
  await settings.getByLabel('効果音の音量', { exact: true }).fill('0.4');
  await page.getByLabel('描画品質', { exact: true }).selectOption('low');
  await expect(page.getByText('この端末に保存できません。開いている間は設定と自己ベストを保持します。')).toBeVisible();
  await page.getByRole('button', { name: '戻る', exact: true }).click();
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await waitForStart(page);
  await expect(page.locator('canvas')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog').getByLabel('効果音の音量', { exact: true })).toHaveValue('0.4');
  await page.getByRole('button', { name: 'ホームへ', exact: true }).click();
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await expect(settings.getByLabel('効果音の音量', { exact: true })).toHaveValue('0.4');
  await expect(page.getByLabel('描画品質', { exact: true })).toHaveValue('low');
});
