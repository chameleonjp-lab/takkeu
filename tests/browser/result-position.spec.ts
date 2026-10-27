import { test, expect, waitForStart } from '../helpers/browserTest';
import type { Page } from '@playwright/test';
import type {} from '../helpers/appHarness';
const version = 'takkeu-web-clear-3500-1';
const id = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12, '0')}`;
async function fixture(page: Page, options: { failSubmit?: boolean; failPosition?: boolean; holdPosition?: boolean; holdSubmit?: boolean; excluded?: boolean; rank?: number } = {}) {
  let starts = 0, submissions = 0, positions = 0, failedSubmit = false, failedPosition = false;
  let releasePosition = () => {}, releaseSubmit = () => {};
  const pendingPosition = new Promise<void>(resolve => { releasePosition = resolve; });
  const pendingSubmit = new Promise<void>(resolve => { releaseSubmit = resolve; });
  const calls: { rpc: string; body: Record<string, unknown> }[] = [];
  await page.route('https://*.supabase.co/rest/v1/rpc/**', async route => {
    const rpc = route.request().url().split('/').at(-1)!, body = route.request().postDataJSON(); calls.push({ rpc, body });
    if (rpc === 'start_takkeu_clear_play_v2') return route.fulfill({ json: { accepted: true, start_id: body.p_start_id, play_id: id(++starts), display_name: body.p_display_name, normalized_name: body.p_display_name, game_slug: 'takkeu', client_version: version, rules_version: 'goal-3500-v1' } });
    if (rpc === 'finish_takkeu_clear_play_v2') return route.fulfill({ json: { accepted: true, play_id: body.p_play_id, game_slug: 'takkeu', result_type: body.p_result_type, reached_wave: 1, score: body.p_score, lost_balls: body.p_lost_balls, rules_version: 'goal-3500-v1' } });
    if (rpc === 'submit_score_idempotent_v1') {
      submissions++;
      if (options.holdSubmit) await pendingSubmit;
      if (options.failSubmit && !failedSubmit) { failedSubmit = true; return route.fulfill({ status: 503, json: {} }); }
      return route.fulfill({ json: [{ accepted: true, result_play_id: body.p_play_id, result_submission_id: body.p_submission_id, result_display_name: body.p_display_name, result_normalized_name: body.p_display_name, result_first_score: 12, result_best_score: Math.max(1500, body.p_score), result_play_count: starts }] });
    }
    if (rpc === 'get_takkeu_player_position_v1') {
      positions++; if (options.holdPosition) await pendingPosition;
      if (options.failPosition && !failedPosition) { failedPosition = true; return route.fulfill({ status: 503, json: {} }); }
      return route.fulfill({ json: options.excluded ? [] : [{ rank_no: options.rank ?? 123, total_entries: 250, best_score: 1500 }] });
    }
    if (rpc === 'get_best_score_ranking' || rpc === 'get_takkeu_hall_v2') return route.fulfill({ json: [] });
    throw Error(`Unexpected RPC ${rpc}`);
  });
  await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/tests/fixtures/stage3.html?ranking=remote');
  await page.getByLabel('ランキングの名前').fill('順位テスト');
  await page.getByRole('button', { name: 'はじめる', exact: true }).click(); await waitForStart(page);
  return { calls, submissions: () => submissions, positions: () => positions, releasePosition, releaseSubmit };
}
async function finish(page: Page) {
  await page.evaluate(() => { window.stage3.show(12); window.stage3.finish(); }); await page.clock.runFor(16);
  await expect(page.locator('[data-result]')).toBeVisible();
}

test('登録確認前には取得せず、100位超でもDB自己ベストの順位を表示する', async ({ page }) => {
  const remote = await fixture(page, { holdSubmit: true }); await finish(page);
  const finishCall = remote.calls.find(call => call.rpc === 'finish_takkeu_clear_play_v2');
  expect(finishCall?.body.p_lost_balls).toBeGreaterThan(0);
  await expect(page.locator('[data-position-message]')).toHaveText('順位を集計中…'); expect(remote.positions()).toBe(0);
  await expect(page.getByRole('button', { name: 'もう一度', exact: true })).toBeEnabled();
  remote.releaseSubmit(); await expect(page.locator('[data-position-message]')).toHaveText('123位 / 250登録中');
  await expect(page.locator('[data-position-note]')).toContainText('1,500ラリー'); await expect(page.locator('[data-top100]')).toBeHidden();
  expect(remote.calls.findIndex(c => c.rpc === 'get_takkeu_player_position_v1')).toBeGreaterThan(remote.calls.findIndex(c => c.rpc === 'submit_score_idempotent_v1'));
});
test('スコア送信失敗時は順位を出さず同じIDの再送成功後に表示する', async ({ page }) => {
  const remote = await fixture(page, { failSubmit: true }); await finish(page);
  await expect(page.locator('[data-position-message]')).toHaveText('順位を取得できませんでした'); expect(remote.positions()).toBe(0);
  await page.getByRole('button', { name: '記録を再送する' }).click();
  await expect(page.locator('[data-position-message]')).toHaveText('123位 / 250登録中');
  const attempts = remote.calls.filter(c => c.rpc === 'submit_score_idempotent_v1'); expect(attempts[0]!.body).toEqual(attempts[1]!.body);
});
test('順位通信失敗は再取得でき、TOP100の同順位も控えめに表示する', async ({ page }) => {
  const remote = await fixture(page, { failPosition: true, rank: 1 }); await finish(page);
  await expect(page.locator('[data-position-message]')).toHaveText('順位を取得できませんでした');
  await page.getByRole('button', { name: '順位を再取得' }).click();
  await expect(page.locator('[data-position-message]')).toHaveText('1位 / 250登録中'); await expect(page.locator('[data-top100]')).toBeVisible();
  expect(remote.submissions()).toBe(1); expect(remote.positions()).toBe(2);
});
test('順位応答待ちで再プレイしても古い順位は新プレイに表示しない', async ({ page }) => {
  const remote = await fixture(page, { holdPosition: true }); await finish(page);
  await expect.poll(remote.positions).toBe(1); await expect(page.locator('[data-position-message]')).toHaveText('順位を集計中…');
  await page.getByRole('button', { name: 'もう一度', exact: true }).click(); await waitForStart(page);
  remote.releasePosition(); await page.clock.runFor(50);
  await expect(page.locator('[data-result-position]')).toBeHidden(); await expect(page.locator('[data-position-message]')).toHaveText('');
  await finish(page); await expect(page.locator('[data-position-message]')).toHaveText('123位 / 250登録中');
});
test('集計対象外の名前には架空の順位を表示しない', async ({ page }) => {
  await fixture(page, { excluded: true }); await finish(page);
  await expect(page.locator('[data-position-message]')).toHaveText('この登録名は現在ランキング対象外です。');
  await expect(page.locator('[data-top100]')).toBeHidden();
});
