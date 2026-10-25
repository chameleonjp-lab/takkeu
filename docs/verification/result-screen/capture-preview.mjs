// Run a local Vite server on 4177 first. All Supabase traffic is mocked.
import { webkit } from 'playwright';
import { fileURLToPath } from 'node:url';
const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const errors = []; page.on('pageerror', error => errors.push(error.message));
const playId = '22222222-2222-4222-8222-222222222222';
try {
  await page.route('https://*.supabase.co/**', async route => {
    const rpc = route.request().url().split('/').at(-1), body = route.request().postDataJSON();
    let data;
    if (rpc === 'start_game_play_v1') data = { accepted: true, start_id: body.p_start_id, play_id: playId, display_name: body.p_display_name, normalized_name: body.p_display_name, game_slug: 'takkeu', client_version: body.p_client_version };
    else if (rpc === 'finish_game_play_v1') data = { accepted: true, play_id: playId, game_slug: 'takkeu', result_type: body.p_result_type, reached_wave: 1, score: body.p_score };
    else if (rpc === 'submit_score_idempotent_v1') data = [{ accepted: true, result_play_id: playId, result_submission_id: body.p_submission_id, result_display_name: body.p_display_name, result_normalized_name: body.p_display_name, result_first_score: 1500, result_best_score: 1500, result_play_count: 1 }];
    else if (rpc === 'get_takkeu_player_position_v1') data = [{ rank_no: 3, total_entries: 620, best_score: 1500 }];
    else if (rpc === 'get_best_score_ranking') data = [{ rank_no: 1, display_name: 'ラリー先輩', best_score: 2000, play_count: 10 }, { rank_no: 1, display_name: 'つなぐ達人', best_score: 2000, play_count: 8 }, { rank_no: 3, display_name: '演出確認', best_score: 1500, play_count: 1 }];
    else throw Error(`Unexpected RPC: ${rpc}`);
    await route.fulfill({ json: data });
  });
  await page.goto('http://127.0.0.1:4177/tests/fixtures/stage3.html?ranking=remote');
  await page.getByLabel('ランキングの名前').fill('演出確認');
  await page.getByRole('button', { name: 'はじめる', exact: true }).click();
  await page.waitForFunction(() => window.stage3.snapshot().phase === 'running');
  await page.evaluate(() => { window.stage3.show(1500); window.stage3.finish(); });
  await page.locator('[data-result-position][data-state="loaded"]').waitFor({ state: 'visible' });
  if (await page.locator('[data-position-message]').innerText() !== '3位 / 620登録中') throw Error('Wrong rank preview');
  if (await page.locator('[data-result-score]').innerText() !== '1500') throw Error('Wrong score preview');
  await page.waitForTimeout(800);
  for (let i = 0; i < 3; i++) {
    await page.screenshot({ path: fileURLToPath(new URL(`evidence/final/webkit-combined-${i}.png`, import.meta.url)), fullPage: true });
    await page.waitForTimeout(110);
  }
  if (errors.length) throw Error(errors.join('\n'));
  console.log('Combined app preview: 1500 rally, mocked rank 3 / 620, TOP100, local best1500; 3 continuous screenshots. No live writes.');
} finally { await browser.close(); }
