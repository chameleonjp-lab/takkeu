import { expect, test } from '../helpers/browserTest';
import type {} from '../helpers/appHarness';

const version = 'takkeu-web-ranking-1';
const playId = '22222222-2222-4222-8222-222222222222';
type RpcCall = { rpc: string; body: Record<string, unknown> };

async function mockRanking(page: import('@playwright/test').Page, failScore = false, failGuest = false) {
  const calls: RpcCall[] = []; let failed = false, guestFailed = false;
  await page.route('https://mlpnjgezrnhdxsxolyzj.supabase.co/rest/v1/rpc/**', async route => {
    const rpc = route.request().url().split('/').at(-1)!, body = route.request().postDataJSON() as Record<string, unknown>;
    calls.push({ rpc, body });
    if (rpc === 'submit_score_idempotent_v1' && failScore && !failed) { failed = true; await route.fulfill({ status: 503, json: { code: 'unavailable' } }); return; }
    if (rpc === 'start_takkeu_guest_play_v1' && failGuest && !guestFailed) { guestFailed = true; await route.fulfill({ status: 503, json: { code: 'unavailable' } }); return; }
    let data: unknown;
    if (rpc === 'start_game_play_v1') data = { accepted: true, start_id: body.p_start_id, play_id: playId, game_slug: 'takkeu', display_name: body.p_display_name, normalized_name: body.p_display_name, client_version: version };
    if (rpc === 'start_takkeu_guest_play_v1') data = { accepted: true, start_id: body.p_start_id, play_id: playId, game_slug: 'takkeu', client_version: version };
    if (rpc === 'finish_game_play_v1') data = { accepted: true, play_id: body.p_play_id, game_slug: 'takkeu', result_type: body.p_result_type, reached_wave: 1, score: body.p_score };
    if (rpc === 'submit_score_idempotent_v1') data = [{ accepted: true, result_submission_id: body.p_submission_id, result_play_id: body.p_play_id, result_display_name: body.p_display_name, result_normalized_name: body.p_display_name, result_first_score: body.p_score, result_best_score: body.p_score, result_play_count: 1 }];
    if (rpc === 'get_best_score_ranking') data = Array.from({ length: 30 }, (_, i) => ({ rank_no: i < 2 ? 1 : i + 1, display_name: `プレイヤー${i + 1}`, best_score: 100 - i, play_count: i + 1 }));
    await route.fulfill({ json: data });
  });
  return calls;
}
async function open(page: import('@playwright/test').Page) {
  await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/tests/fixtures/stage3.html?ranking=remote');
}
async function finish(page: import('@playwright/test').Page, score = 12) {
  await page.evaluate(score => { window.stage3.show(score); window.stage3.finish(); }, score);
  await page.clock.runFor(16);
  await expect(page.getByRole('heading', { name: 'ナイスラリー！' })).toBeVisible();
}

test('名前なしで遊べて結果には上位30名と正式URLのXシェアが表示される', async ({ page }) => {
  const calls = await mockRanking(page); await open(page);
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await finish(page, 12);
  await expect(page.locator('[data-ranking-body] tr')).toHaveCount(30);
  const starts = () => calls.filter(call => call.rpc === 'start_takkeu_guest_play_v1');
  expect(starts()).toHaveLength(1);
  expect(starts()[0]!.body).toEqual({ p_start_id: expect.stringMatching(/^[0-9a-f-]{36}$/), p_game_slug: 'takkeu', p_client_version: version });
  expect(calls.filter(call => ['start_game_play_v1', 'finish_game_play_v1', 'submit_score_idempotent_v1'].includes(call.rpc))).toEqual([]);
  await expect(page.locator('[data-ranking-participation]')).toContainText('名前なし');
  await expect(page.locator('[data-ranking-participation]')).toContainText('プレイ回数のみ');
  const share = new URL(await page.locator('[data-share-x]').getAttribute('href') ?? '');
  expect(share.searchParams.get('text')).toContain('12ラリー');
  expect(share.searchParams.get('url')).toBe('https://chameleonjp-lab.github.io/takkeu/');
  const positions = await page.evaluate(() => ({ score: document.querySelector('[data-result-score]')!.getBoundingClientRect().bottom, replay: document.querySelector('[data-result] [data-action="retry"]')!.getBoundingClientRect().top, best: document.querySelector('[data-result] [data-best]')!.getBoundingClientRect().top }));
  expect(positions.replay).toBeGreaterThanOrEqual(positions.score); expect(positions.replay).toBeLessThan(positions.best);
  await page.getByRole('button', { name: 'もう一度', exact: true }).click(); await page.clock.runFor(16);
  await expect(page.getByLabel('ラリー数', { exact: true })).toHaveText('0');
  expect(await page.evaluate(() => window.stage3.snapshot().simTime)).toBeLessThan(0.1);
  await expect.poll(() => starts().length).toBe(2);
  expect(starts()[0]!.body.p_start_id).not.toBe(starts()[1]!.body.p_start_id);
});

test('匿名開始の応答喪失後もすぐ遊べてonline復帰時は同じIDで再送する', async ({ page }, info) => {
  const calls = await mockRanking(page, false, true); await open(page);
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await expect(page.getByTestId('game-screen')).toBeVisible();
  const starts = () => calls.filter(c => c.rpc === 'start_takkeu_guest_play_v1');
  await expect.poll(() => starts().length).toBe(1);
  const first = starts()[0]!.body;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => starts().length).toBe(2);
  expect(starts()[1]!.body).toEqual(first);
  await finish(page, 20);
  expect(calls.some(c => c.rpc === 'finish_game_play_v1' || c.rpc === 'submit_score_idempotent_v1')).toBe(false);
  await page.screenshot({ path: info.outputPath('guest-count-result.png') });
});

test('通信不能で始めた匿名2回の記録を再読込後も保ち復旧時に送る', async ({ page }) => {
  let online = false;
  const starts: Record<string, unknown>[] = [], accepted = new Set<string>();
  await page.route('https://mlpnjgezrnhdxsxolyzj.supabase.co/rest/v1/rpc/**', async route => {
    const rpc = route.request().url().split('/').at(-1)!, body = route.request().postDataJSON() as Record<string, unknown>;
    if (rpc === 'start_takkeu_guest_play_v1') {
      starts.push(body);
      if (!online) { await route.abort(); return; }
      accepted.add(String(body.p_start_id));
      await route.fulfill({ json: { accepted: true, start_id: body.p_start_id, play_id: playId, game_slug: 'takkeu', client_version: version } }); return;
    }
    expect(rpc).toBe('get_best_score_ranking'); await route.fulfill({ json: [] });
  });
  await open(page); await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await expect(page.getByTestId('game-screen')).toBeVisible(); await finish(page);
  await page.getByRole('button', { name: 'もう一度', exact: true }).click();
  const stored = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('takkeu.guest-starts.v1.')).map(k => JSON.parse(localStorage.getItem(k)!)));
  expect(stored).toHaveLength(2);
  await page.reload(); await expect(page.getByRole('button', { name: 'はじめる', exact: true })).toBeVisible();
  online = true; await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => accepted.size).toBe(2);
  expect([...accepted].sort()).toEqual(stored.map((row: { startId: string }) => row.startId).sort());
  expect(stored.map((row: { startId: string }) => row.startId)).toContain(starts[0]!.p_start_id);
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('takkeu.guest-starts.v1.')).length)).toBe(0);
});

test('online復帰が古い通信の失敗より先でも送信待ちを再開する', async ({ page }) => {
  const starts: Record<string, unknown>[] = []; let release!: () => void;
  await page.route('https://mlpnjgezrnhdxsxolyzj.supabase.co/rest/v1/rpc/start_takkeu_guest_play_v1', async route => {
    const body = route.request().postDataJSON() as Record<string, unknown>; starts.push(body);
    if (starts.length === 1) { await new Promise<void>(resolve => { release = resolve; }); await route.abort(); return; }
    await route.fulfill({ json: { accepted: true, start_id: body.p_start_id, play_id: playId, game_slug: 'takkeu', client_version: version } });
  });
  await open(page); await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await expect.poll(() => starts.length).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event('online'))); release();
  await expect.poll(() => starts.length).toBe(2);
  expect(starts[1]).toEqual(starts[0]);
});

test('名前ありは開始時に一度記録し通常終了を自動送信する', async ({ page }) => {
  const calls = await mockRanking(page); await open(page);
  await page.getByLabel('ランキングの名前').fill(' テスト ');
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await expect(page.getByTestId('game-screen')).toBeVisible();
  expect(calls.filter(call => call.rpc === 'start_game_play_v1')).toHaveLength(1);
  expect(calls[0]!.body.p_display_name).toBe('テスト');
  expect(calls.filter(call => call.rpc === 'submit_score_idempotent_v1')).toHaveLength(0);
  await finish(page, 42);
  await expect(page.locator('[data-ranking-status]')).toHaveText('ランキングに記録しました。');
  expect(calls.filter(call => call.rpc === 'submit_score_idempotent_v1')).toHaveLength(1);
  expect(calls.find(call => call.rpc === 'finish_game_play_v1')!.body).toMatchObject({ p_play_id: playId, p_score: 42, p_result_type: 'game_over' });
});

test('送信失敗後も結果と共有を保ち同じIDで再送する', async ({ page }) => {
  const calls = await mockRanking(page, true); await open(page);
  await page.getByLabel('ランキングの名前').fill('再送テスト');
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await expect(page.getByTestId('game-screen')).toBeVisible(); await finish(page, 7);
  const retry = page.getByRole('button', { name: '記録を再送する' }); await expect(retry).toBeVisible();
  await expect(page.locator('[data-result-score]')).toHaveText('7');
  await expect(page.locator('[data-share-x]')).toBeVisible();
  const first = calls.find(call => call.rpc === 'submit_score_idempotent_v1')!.body;
  await retry.click(); await expect(retry).toBeHidden();
  await expect(page.locator('[data-ranking-status]')).toHaveText('ランキングに記録しました。');
  expect(calls.filter(call => call.rpc === 'submit_score_idempotent_v1').map(call => call.body)).toEqual([first, first]);
});

test('通信停止中も名前なしのプレイと再プレイが使えランキングは再取得できる', async ({ page }) => {
  await page.route('https://mlpnjgezrnhdxsxolyzj.supabase.co/**', route => route.abort());
  await open(page); await page.getByRole('button', { name: 'はじめる', exact: true }).click(); await finish(page);
  await expect(page.locator('[data-ranking-message]')).toContainText('取得できません');
  await expect(page.locator('[data-share-x]')).toBeVisible();
  await page.getByRole('button', { name: 'もう一度', exact: true }).click();
  await expect(page.getByTestId('game-screen')).toBeVisible();
});
