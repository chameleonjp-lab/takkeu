import { expect, test } from '../helpers/browserTest';

test('ホームにタイトルと開始ボタンを表示し、自動で開始しない', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'タッケウ', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'はじめる', exact: true })).toBeVisible();
  await expect(page.getByTestId('game-screen')).toBeHidden();
});
