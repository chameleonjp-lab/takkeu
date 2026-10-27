import { expect, test, waitForStart } from '../helpers/browserTest';

test('通常のゲーム開始・再プレイも本番APIへ送らず検査内で確認応答を返す', async ({ page, rankingTraffic }) => {
  await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/');
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await waitForStart(page);
  const starts = () => rankingTraffic.filter(call => call.rpc === 'start_takkeu_guest_play_v1');
  const pending = () => page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('takkeu.guest-starts.v1.')).length);
  await expect.poll(() => starts().length).toBe(1);
  await expect.poll(pending).toBe(0);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '最初からやり直す', exact: true }).click();
  await waitForStart(page);
  await expect.poll(() => starts().length).toBe(2);
  await expect.poll(pending).toBe(0);
  expect(starts()[0]!.body.p_start_id).not.toBe(starts()[1]!.body.p_start_id);
  await page.mouse.click(5, 5); await page.clock.runFor(4000);
  await expect(page.locator('[data-result] h2')).toBeVisible();
  await expect.poll(() => rankingTraffic.filter(call => call.rpc === 'get_best_score_ranking').length).toBe(1);
  await expect.poll(() => rankingTraffic.filter(call => call.rpc === 'get_takkeu_hall_v2').length).toBe(1);
  expect(rankingTraffic.map(call => call.rpc)).toEqual(['start_takkeu_guest_play_v1', 'start_takkeu_guest_play_v1', 'get_takkeu_hall_v2', 'get_best_score_ranking']);
  expect(rankingTraffic.find(call => call.rpc === 'get_takkeu_hall_v2')!.body).toEqual({ p_limit: 30 });
});
