import { writeFileSync } from 'node:fs';
import { expect, test, waitForStart, type Page } from '../helpers/browserTest';
import type {} from '../helpers/appHarness';

const uid = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12, '0')}`;
async function setup(page: Page, options: { failHall?: boolean; holdHall?: boolean; excluded?: boolean; name?: string } = {}) {
  const calls: { rpc: string; body: Record<string, unknown> }[] = [];
  let starts = 0, hallCalls = 0;
  const releases: (() => void)[] = [];
  await page.route('https://*.supabase.co/rest/v1/rpc/**', async route => {
    const rpc = route.request().url().split('/').at(-1)!, body = route.request().postDataJSON(); calls.push({ rpc, body });
    if (rpc === 'start_takkeu_clear_play_v1') return route.fulfill({ json: { accepted: true, start_id: body.p_start_id, play_id: uid(++starts), display_name: body.p_display_name, normalized_name: body.p_display_name, game_slug: 'takkeu', client_version: body.p_client_version, rules_version: 'goal-3000-v1' } });
    if (rpc === 'finish_takkeu_clear_play_v1') return route.fulfill({ json: { accepted: true, play_id: body.p_play_id, game_slug: 'takkeu', result_type: body.p_result_type, reached_wave: 1, score: body.p_score, lost_balls: body.p_lost_balls, rules_version: 'goal-3000-v1' } });
    if (rpc === 'submit_score_idempotent_v1') return route.fulfill({ json: [{ accepted: true, result_play_id: body.p_play_id, result_submission_id: body.p_submission_id, result_display_name: body.p_display_name, result_normalized_name: body.p_display_name, result_first_score: body.p_score, result_best_score: Math.max(4001, body.p_score), result_play_count: starts }] });
    if (rpc === 'register_takkeu_hall_v1') {
      hallCalls++;
      if (options.holdHall) await new Promise<void>(resolve => releases.push(resolve));
      if (options.failHall && hallCalls === 1) return route.fulfill({ status: 503, json: {} });
      return route.fulfill({ json: options.excluded ? { accepted: false, reason: 'hall_ineligible' } : { accepted: true, play_id: body.p_play_id, submission_id: body.p_submission_id, rules_version: 'goal-3000-v1', hall_number: 7, display_name: body.p_display_name, normalized_name: body.p_display_name, registered_at: '2026-10-27T12:00:00Z' } });
    }
    if (rpc === 'get_takkeu_player_position_v1') return route.fulfill({ json: [{ rank_no: 3, total_entries: 100, best_score: 4001 }] });
    if (['get_best_score_ranking', 'get_takkeu_hall_v1'].includes(rpc)) return route.fulfill({ json: [] });
    if (rpc === 'start_takkeu_guest_play_v1') return route.fulfill({ json: { accepted: true, start_id: body.p_start_id, play_id: uid(99), game_slug: 'takkeu', client_version: body.p_client_version } });
    throw Error(`Unexpected RPC ${rpc}`);
  });
  await page.setViewportSize({ width: 402, height: 874 });
  await page.clock.install({ time: new Date('2026-10-27T12:00:00Z') }); await page.clock.pauseAt(new Date('2026-10-27T12:00:01Z'));
  await page.goto('/tests/fixtures/stage3.html?ranking=remote');
  if (options.name !== '') await page.getByLabel('ランキングの名前').fill(options.name ?? 'クリアテスト');
  await page.getByRole('button', { name: 'はじめる', exact: true }).click(); await waitForStart(page);
  return { calls, releases, hallCalls: () => hallCalls };
}
async function clear(page: Page) {
  await page.evaluate(() => window.stage3.goal()); await page.clock.runFor(200);
  await expect(page.locator('[data-result-comment]')).toHaveText('3000ラリー達成！ゲームクリア！');
}

test('3000/30球で正確にクリアし、3D描画を止め、正式番号入り賞状PNGを保存できる', async ({ page }, info) => {
  const remote = await setup(page); await clear(page);
  await expect(page.locator('[data-hall-message]')).toHaveText('殿堂登録 第7号');
  const frozen = await page.evaluate(() => ({ snapshot: window.stage3.snapshot(), renders: window.stage3.metrics().viewRenders, events: window.stage3.metrics().events }));
  expect(frozen.snapshot).toMatchObject({ score: 3000, phase: 'gameover', endReason: 'clear', lostBallCount: 0 }); expect(frozen.snapshot.balls).toHaveLength(30);
  expect(frozen.events.filter(e => e.kind === 'player-hit')).toHaveLength(1); expect(frozen.events.filter(e => e.kind === 'game-clear')).toHaveLength(1);
  await page.clock.runFor(3000);
  expect(await page.evaluate(() => ({ snapshot: window.stage3.snapshot(), renders: window.stage3.metrics().viewRenders }))).toEqual({ snapshot: frozen.snapshot, renders: frozen.renders });
  expect(await page.locator('[data-result-score]').evaluate(e => getComputedStyle(e).animationName)).toBe('none');
  await expect(page.locator('[data-bolt]')).toHaveCount(0);
  await expect(page.locator('[data-position-note]')).toContainText('4,001ラリー');
  await page.locator('[data-certificate-create]').click();
  const image = page.locator('[data-certificate-image]'); await expect(image).toBeVisible();
  await expect(image).toHaveAttribute('alt', /殿堂登録 第7号/);
  const bytes = Buffer.from(await image.evaluate(async el => Array.from(new Uint8Array(await (await fetch((el as HTMLImageElement).src)).arrayBuffer()))));
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a'); expect(bytes.readUInt32BE(16)).toBe(900); expect(bytes.readUInt32BE(20)).toBe(1200);
  writeFileSync(info.outputPath('certificate.png'), bytes); await info.attach('certificate.png', { body: bytes, contentType: 'image/png' });
  await page.screenshot({ path: info.outputPath('clear-result.png'), fullPage: true });
  const url = await image.getAttribute('src');
  const download = page.waitForEvent('download'); await page.locator('[data-certificate-download]').click(); expect((await download).suggestedFilename()).toBe('takkeu-hall-7.png');
  expect(remote.calls.find(c => c.rpc === 'finish_takkeu_clear_play_v1')?.body).toMatchObject({ p_score: 3000, p_result_type: 'clear', p_lost_balls: 0, p_client_version: 'takkeu-web-clear-1' });
  await page.getByRole('button', { name: 'ホームへ', exact: true }).click();
  expect(await page.evaluate(async value => { try { await fetch(value!); return true; } catch { return false; } }, url)).toBe(false);
});

test('スコア受領後の殿堂通信失敗は永続再送し、スコアを二重送信しない', async ({ page }) => {
  const remote = await setup(page, { failHall: true }); await clear(page);
  await expect(page.locator('[data-hall-message]')).toHaveText('殿堂登録は再送できます。');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('takkeu.ranking.pending.v1')!)[0].scoreAcknowledged)).toBe(true);
  await expect(page.locator('[data-position-message]')).toHaveText('3位 / 100登録中');
  await page.getByRole('button', { name: '殿堂登録を再送', exact: true }).click();
  await expect(page.locator('[data-hall-message]')).toHaveText('殿堂登録 第7号');
  expect(remote.calls.filter(c => c.rpc === 'submit_score_idempotent_v1')).toHaveLength(1);
  const attempts = remote.calls.filter(c => c.rpc === 'register_takkeu_hall_v1'); expect(attempts[0]!.body).toEqual(attempts[1]!.body);
  expect(new URL((await page.locator('[data-share-x]').getAttribute('href'))!).searchParams.get('text')).toContain('殿堂登録 第7号');
});

test('再挑戦後のクリアに古いプレイの殿堂応答が混ざらない', async ({ page }) => {
  const remote = await setup(page, { holdHall: true }); await clear(page); await expect.poll(() => remote.releases.length).toBe(1);
  await page.getByRole('button', { name: 'もう一度', exact: true }).click(); await waitForStart(page); await clear(page);
  remote.releases[0]!(); await expect.poll(() => remote.releases.length).toBe(2);
  await expect(page.locator('[data-hall-message]')).toHaveText('殿堂登録を確認しています。');
  remote.releases[1]!(); await expect(page.locator('[data-hall-message]')).toHaveText('殿堂登録 第7号');
  expect(remote.calls.filter(c => c.rpc === 'register_takkeu_hall_v1').map(c => c.body.p_play_id)).toEqual([uid(1), uid(2)]);
});

test('名前なしのクリアは番号なし賞状だけを作り、スコアや殿堂を送信しない', async ({ page }) => {
  const remote = await setup(page, { name: '' }); await clear(page);
  await expect(page.locator('[data-hall-note]')).toContainText('名前なし');
  await page.locator('[data-certificate-create]').click(); await expect(page.locator('[data-certificate-image]')).toHaveAttribute('alt', /殿堂番号なし/);
  expect(remote.calls.some(c => ['finish_takkeu_clear_play_v1','submit_score_idempotent_v1','register_takkeu_hall_v1'].includes(c.rpc))).toBe(false);
});

test('2999ラリーの実際の落球終了はクリアや殿堂入りにならない', async ({ page }) => {
  const remote = await setup(page); await page.evaluate(() => window.stage3.goalMiss()); await page.clock.runFor(3000);
  await expect(page.locator('[data-result]')).toBeVisible(); await expect(page.locator('[data-certificate]')).toBeHidden();
  expect(await page.evaluate(() => window.stage3.snapshot())).toMatchObject({ score: 2999, endReason: 'loss', lostBallCount: 1 });
  expect(remote.calls.some(c => c.rpc === 'register_takkeu_hall_v1')).toBe(false);
  expect(remote.calls.find(c => c.rpc === 'finish_takkeu_clear_play_v1')?.body.p_result_type).toBe('game_over');
});

test('20文字の絵文字名と対象外名でも画像・結果・再挑戦が使える', async ({ page }, info) => {
  const name = '🏓'.repeat(20); await setup(page, { name, excluded: true }); await clear(page);
  await expect(page.locator('[data-hall-message]')).toContainText('対象外');
  await page.locator('[data-certificate-create]').click(); await expect(page.locator('[data-certificate-image]')).toBeVisible();
  await expect(page.locator('[data-certificate-image]')).toHaveAttribute('alt', `${name}の3000ラリー達成賞状（殿堂番号なし）`);
  await page.screenshot({ path: info.outputPath('long-name-certificate.png'), fullPage: true });
  await page.setViewportSize({ width: 874, height: 402 });
  await page.getByRole('button', { name: 'もう一度', exact: true }).click(); await waitForStart(page);
  expect(await page.evaluate(() => window.stage3.snapshot())).toMatchObject({ phase: 'running', score: 0, endReason: null });
  await expect(page.locator('[data-certificate]')).toBeHidden();
});

test('画像共有の非対応・例外でもPNG保存は使える', async ({ page }) => {
  await setup(page, { name: '' }); await clear(page);
  await page.evaluate(() => Object.defineProperty(navigator, 'canShare', { configurable: true, value() { throw new DOMException('unsupported', 'NotSupportedError'); } }));
  await page.locator('[data-certificate-create]').click();
  await expect(page.locator('[data-certificate-image]')).toBeVisible();
  await expect(page.locator('[data-certificate-message]')).toHaveText('賞状画像を作成しました。');
  await expect(page.locator('[data-certificate-share]')).toBeHidden();
  await expect(page.locator('[data-certificate-download]')).toHaveAttribute('href', /^blob:/);
});

test('賞状生成の途中でホームへ戻ると古い画像を表示しない', async ({ page }) => {
  await setup(page, { name: '' }); await clear(page);
  await page.evaluate(() => {
    const w = window as typeof window & { releaseCertificate?: () => void };
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: new Promise<void>(resolve => { w.releaseCertificate = resolve; }) } });
  });
  await page.locator('[data-certificate-create]').click();
  await expect(page.locator('[data-certificate-message]')).toHaveText('賞状画像を作成しています。');
  await page.getByRole('button', { name: 'ホームへ', exact: true }).click();
  await page.evaluate(() => (window as typeof window & { releaseCertificate?: () => void }).releaseCertificate?.());
  await page.clock.runFor(32);
  await expect(page.locator('[data-certificate-image]')).not.toHaveAttribute('src');
  await expect(page.locator('[data-certificate]')).toBeHidden();
});
