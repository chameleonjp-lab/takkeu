import { expect, it, vi } from 'vitest';
import { createResultPosition } from '../../src/ranking/resultPosition';
import { createRankingClient } from '../../src/ranking/client';
import { createRankingController } from '../../src/ranking/controller';
import type { PendingResult } from '../../src/ranking/client';
const play = { startId: '11111111-1111-4111-8111-111111111111', playId: '22222222-2222-4222-8222-222222222222', normalizedName: 'テスト', displayName: 'テスト' };
const submissionId = '33333333-3333-4333-8333-333333333333';
const position = { rank: 123, total: 250, bestScore: 1500 };
const response = (data: unknown) => new Response(JSON.stringify(data));

it('fetches a single server aggregate without a TOP100 limit or downloading players', async () => {
  const client = createRankingClient(async (url, init) => {
    expect(String(url).split('/').at(-1)).toBe('get_takkeu_player_position_v1');
    expect(JSON.parse(String(init?.body))).toEqual({ p_normalized_name: 'テスト' });
    return response([{ rank_no: 123, total_entries: 250, best_score: 1500 }]);
  });
  expect(await client.position('テスト')).toEqual(position);
});
it.each([
  [{ rank_no: 0, total_entries: 1, best_score: 10 }], [{ rank_no: 5, total_entries: 4, best_score: 10 }],
  [{ rank_no: 1.5, total_entries: 5, best_score: 10 }], [{ rank_no: 1, total_entries: 5, best_score: -1 }],
  [{ rank_no: 1, total_entries: 5, best_score: 10 }, { rank_no: 1, total_entries: 5, best_score: 10 }], {},
])('rejects an invalid position response %j', async rows => {
  await expect(createRankingClient(async () => response(rows)).position('テスト')).rejects.toThrow();
});
it('distinguishes an excluded/missing registration from a transport error', async () => {
  expect(await createRankingClient(async () => response([])).position('テスト')).toBeNull();
  await expect(createRankingClient(async () => { throw Error('offline'); }).position('テスト')).rejects.toMatchObject({ retryable: true });
});
it('waits for THIS play and submission acknowledgement, never the global queue', async () => {
  const remote = { position: vi.fn(async () => position) };
  const controller = createResultPosition(remote);
  controller.show(play); expect(controller.state()).toEqual({ status: 'loading' });
  await controller.submission({ playId: 'older', submissionId, status: 'submitted' });
  expect(remote.position).not.toHaveBeenCalled();
  await controller.submission({ playId: play.playId, submissionId, status: 'submitting' });
  await controller.submission({ playId: play.playId, submissionId: 'different', status: 'submitted' });
  expect(remote.position).not.toHaveBeenCalled();
  await controller.submission({ playId: play.playId, submissionId, status: 'submitted' });
  expect(controller.state()).toEqual({ status: 'loaded', ...position });
});
it('retains no position on submission failure and retries exactly that queued result', async () => {
  const local = new Map<string, string>();
  const remote = { startGuest: async () => {}, start: async () => play, finish: async () => {},
    submit: vi.fn(async (_pending: PendingResult) => {}), top: async () => [], position: vi.fn(async () => position) };
  remote.submit.mockRejectedValueOnce(Error('lost ack'));
  const result = createResultPosition(remote);
  const ranking = createRankingController({ getItem: key => local.get(key) ?? null, setItem: (key, value) => { local.set(key, value); } }, remote, () => {}, event => { void result.submission(event); });
  result.show(play); ranking.finish(play, 12, 'game_over'); await ranking.retry();
  expect(result.state()).toEqual({ status: 'error' }); expect(remote.position).not.toHaveBeenCalled();
  await ranking.retry(); await vi.waitFor(() => expect(result.state()).toEqual({ status: 'loaded', ...position }));
  expect(remote.submit.mock.calls[1]![0].submissionId).toBe(remote.submit.mock.calls[0]![0].submissionId);
});
it('ignores an old rank response during replay, a guest run, or disposal', async () => {
  let resolve!: (value: typeof position) => void;
  const remote = { position: () => new Promise<typeof position>(done => { resolve = done; }) };
  const result = createResultPosition(remote); result.show(play);
  const pending = result.submission({ playId: play.playId, submissionId, status: 'submitted' });
  result.clear(); resolve(position); await pending; expect(result.state()).toEqual({ status: 'hidden' });
  result.show(null); expect(result.state()).toEqual({ status: 'hidden' });
  result.show(play); const late = result.submission({ playId: play.playId, submissionId, status: 'submitted' });
  result.show({ ...play, playId: 'new-play' }); resolve(position); await late; expect(result.state()).toEqual({ status: 'loading' });
  result.dispose(); expect(result.state()).toEqual({ status: 'hidden' });
});
it('keeps best-based ranks on lower scores, allows position retry, and handles exclusions', async () => {
  const remote = { position: vi.fn(async (): Promise<typeof position | null> => position) };
  remote.position.mockRejectedValueOnce(Error('offline'));
  const result = createResultPosition(remote); result.show(play);
  await result.submission({ playId: play.playId, submissionId, status: 'submitted' }); expect(result.state()).toEqual({ status: 'error' });
  await result.retry(); expect(result.state()).toEqual({ status: 'loaded', ...position });
  remote.position.mockResolvedValueOnce(null); await result.retry(); expect(result.state()).toEqual({ status: 'excluded' });
});
it('reports a blocked current submission when an older queued request fails, without accepting its success', async () => {
  let rejectOld!: (error: Error) => void;
  const remote = { startGuest: async () => {}, start: async () => play,
    finish: vi.fn(async (_pending: PendingResult) => {}), submit: async (_pending: PendingResult) => {}, top: async () => [], position: vi.fn(async () => position) };
  remote.finish.mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { rejectOld = reject; }));
  const result = createResultPosition(remote);
  const ranking = createRankingController({ getItem: () => null, setItem: () => {} }, remote, () => {}, event => { void result.submission(event); });
  ranking.finish({ ...play, playId: '44444444-4444-4444-8444-444444444444' }, 900, 'game_over');
  result.show(play); ranking.finish(play, 12, 'game_over');
  const sending = ranking.retry(); rejectOld(Error('offline')); await sending;
  expect(result.state()).toEqual({ status: 'error' }); expect(remote.position).not.toHaveBeenCalled();
  await ranking.retry(); await vi.waitFor(() => expect(result.state()).toEqual({ status: 'loaded', ...position }));
  expect(remote.position).toHaveBeenCalledTimes(1);
});
