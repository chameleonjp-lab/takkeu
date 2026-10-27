import { expect, it, vi } from 'vitest';
import { createRankingClient, RankingError } from '../../src/ranking/client';
import { createRankingController } from '../../src/ranking/controller';
import type { PendingResult, Play } from '../../src/ranking/client';
import type { SubmissionEvent } from '../../src/ranking/controller';
import { RANKING_CONFIG as config } from '../../src/ranking/config';

const play: Play = { startId: '11111111-1111-4111-8111-111111111111', playId: '22222222-2222-4222-8222-222222222222', displayName: 'テスト', normalizedName: 'テスト', rulesVersion: 'goal-3000-v1' };
const submissionId = '33333333-3333-4333-8333-333333333333';
const hall = { number: 7, displayName: 'テスト', normalizedName: 'テスト', registeredAt: '2026-10-27T12:00:00+00:00' };
const pending: PendingResult = { play, submissionId, score: 3000, resultType: 'clear', clientVersion: 'takkeu-web-clear-1', lostBalls: 0 };
function memory() { const data = new Map<string, string>(); return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } }; }
const response = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });

it('uses the new-rule start/finish and validates a server-issued hall receipt', async () => {
  const calls: { endpoint: string; body: Record<string, unknown> }[] = [];
  const client = createRankingClient(async (url, init) => {
    const endpoint = String(url).split('/').at(-1)!; calls.push({ endpoint, body: JSON.parse(String(init!.body)) });
    if (endpoint === 'start_takkeu_clear_play_v1') return response({ accepted: true, start_id: play.startId, play_id: play.playId, game_slug: 'takkeu', display_name: play.displayName, normalized_name: play.normalizedName, client_version: 'takkeu-web-clear-1', rules_version: 'goal-3000-v1' });
    if (endpoint === 'finish_takkeu_clear_play_v1') return response({ accepted: true, play_id: play.playId, game_slug: 'takkeu', result_type: 'clear', reached_wave: 1, score: 3000, lost_balls: 0, rules_version: 'goal-3000-v1' });
    return response({ accepted: true, play_id: play.playId, submission_id: submissionId, rules_version: 'goal-3000-v1', hall_number: 7, display_name: 'テスト', normalized_name: 'テスト', registered_at: hall.registeredAt });
  });
  expect(await client.start(play.startId, 'テスト')).toEqual(play);
  await client.finish(pending); expect(await client.hall(pending)).toEqual(hall);
  expect(calls.map(c => c.endpoint)).toEqual(['start_takkeu_clear_play_v1', 'finish_takkeu_clear_play_v1', 'register_takkeu_hall_v1']);
  expect(calls[2]!.body).toEqual({ p_play_id: play.playId, p_submission_id: submissionId, p_display_name: 'テスト', p_client_version: 'takkeu-web-clear-1' });
  expect(calls.every(c => c.body.p_client_version === 'takkeu-web-clear-1')).toBe(true);
  const wrong = createRankingClient(async () => response({ accepted: true, play_id: play.playId, submission_id: submissionId, rules_version: 'goal-3000-v1', hall_number: 7, display_name: '別名', normalized_name: '別名', registered_at: hall.registeredAt }));
  await expect(wrong.hall(pending)).rejects.toMatchObject({ retryable: false });
});

it('retains acknowledged scores until hall registration succeeds across a reload', async () => {
  const storage = memory(), events: SubmissionEvent[] = [];
  const remote = { start: vi.fn(async () => play), startGuest: async () => {}, finish: vi.fn(async () => {}), submit: vi.fn(async () => {}), position: async () => null, top: async () => [], hall: vi.fn(async (_pending: PendingResult) => hall) };
  remote.hall.mockRejectedValueOnce(new RankingError(true, 'lost receipt'));
  const controller = createRankingController(storage, remote, () => {}, e => events.push(e));
  controller.finish(play, 3000, 'clear', 0); await controller.retry();
  expect(remote.hall).toHaveBeenCalledTimes(1);
  expect(events.some(e => e.status === 'submitted' && e.hallStatus === 'pending')).toBe(true);
  expect(JSON.parse(storage.data.get(config.pendingKey)!)[0]).toMatchObject({ scoreAcknowledged: true, resultType: 'clear', score: 3000 });
  const reloaded = createRankingController(storage, remote, () => {}, e => events.push(e));
  await reloaded.retry();
  expect(remote.submit).toHaveBeenCalledTimes(1); expect(remote.finish).toHaveBeenCalledTimes(1);
  expect(remote.hall.mock.calls[1]![0].submissionId).toBe(remote.hall.mock.calls[0]![0].submissionId);
  expect(events.at(-1)).toMatchObject({ status: 'submitted', hallStatus: 'registered', hall });
  expect(reloaded.state().pendingCount).toBe(0);
});

it('preserves old >3000 pending scores and original client versions without hall registration', async () => {
  const storage = memory();
  const legacy = { ...pending, play: { ...play, rulesVersion: undefined }, score: 4001, resultType: 'game_over', clientVersion: 'takkeu-web-ranking-1', lostBalls: 1 };
  storage.setItem(config.pendingKey, JSON.stringify([legacy]));
  const calls: { endpoint: string; version: unknown }[] = [];
  const client = createRankingClient(async (url, init) => {
    const b = JSON.parse(String(init!.body)), endpoint = String(url).split('/').at(-1)!; calls.push({ endpoint, version: b.p_client_version });
    return response(endpoint === 'finish_takkeu_play_v2' ? { accepted: true, play_id: play.playId, game_slug: 'takkeu', result_type: 'game_over', reached_wave: 1, score: 4001, lost_balls: 1 } : [{ accepted: true, result_play_id: play.playId, result_submission_id: submissionId, result_normalized_name: 'テスト', result_display_name: 'テスト', result_first_score: 4001, result_best_score: 4001, result_play_count: 1 }]);
  });
  const controller = createRankingController(storage, client); await controller.retry();
  expect(controller.state().pendingCount).toBe(0);
  expect(calls).toEqual([{ endpoint: 'finish_takkeu_play_v2', version: 'takkeu-web-ranking-1' }, { endpoint: 'submit_score_idempotent_v1', version: 'takkeu-web-ranking-1' }]);
});

it('treats a moderated hall exclusion as terminal while preserving the accepted score', async () => {
  const remote = { start: async () => play, startGuest: async () => {}, finish: async () => {}, submit: async () => {}, position: async () => null, top: async () => [], hall: async () => null };
  const events: SubmissionEvent[] = [], controller = createRankingController(memory(), remote, () => {}, e => events.push(e));
  controller.finish(play, 3000, 'clear', 2); await controller.retry();
  expect(controller.state()).toMatchObject({ status: 'submitted', pendingCount: 0 });
  expect(events.at(-1)).toMatchObject({ status: 'submitted', hallStatus: 'ineligible' });
});
