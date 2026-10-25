import { afterEach, expect, it, vi } from 'vitest';
import { createRankingClient, RankingError } from '../../src/ranking/client';
import type { PendingResult } from '../../src/ranking/client';
import { createRankingController, validateName } from '../../src/ranking/controller';
import { RANKING_CONFIG } from '../../src/ranking/config';

const startId = '11111111-1111-4111-8111-111111111111';
const playId = '22222222-2222-4222-8222-222222222222';
const submissionId = '33333333-3333-4333-8333-333333333333';
const play = { startId, playId, displayName: 'テスト', normalizedName: 'テスト' };
const pending = { play, submissionId, score: 42, resultType: 'game_over' as const, clientVersion: RANKING_CONFIG.clientVersion };
const storage = () => { const data = new Map<string, string>(); return {
  getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); },
  removeItem: (key: string) => { data.delete(key); }, key: (index: number) => [...data.keys()][index] ?? null,
  get length() { return data.size; },
}; };
const acceptedStart = { accepted: true, start_id: startId, play_id: playId, display_name: 'テスト', normalized_name: 'テスト', game_slug: 'takkeu', client_version: RANKING_CONFIG.clientVersion };
const acceptedFinish = { accepted: true, play_id: playId, game_slug: 'takkeu', result_type: 'game_over', reached_wave: 1, score: 42 };
const acceptedScore = [{ accepted: true, result_submission_id: submissionId, result_play_id: playId, result_display_name: 'テスト', result_normalized_name: 'テスト', result_first_score: 42, result_best_score: 42, result_play_count: 1 }];
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
function api() { return { position: vi.fn(async () => null), start: vi.fn(async (_startId: string, _name: string) => play), startGuest: vi.fn(async (_startId: string) => {}), finish: vi.fn(async (_result: PendingResult) => {}), submit: vi.fn(async (_result: PendingResult) => {}), top: vi.fn(async () => []) }; }
afterEach(() => vi.useRealTimers());

it('accepts guests, trims names and counts Unicode characters without silently truncating', () => {
  expect(validateName('　 ')).toBe('');
  expect(validateName(' テスト ')).toBe('テスト');
  expect(validateName('🏓'.repeat(20))).toBe('🏓'.repeat(20));
  expect(() => validateName('あ'.repeat(21))).toThrow('20');
});

it('counts a guest start without a name or score, even with unavailable storage', async () => {
  const remote = api();
  const local = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  const controller = createRankingController(local, remote);
  expect(await controller.start('')).toBeNull();
  controller.finish(null, 8, 'game_over');
  await controller.retry();
  expect(remote.startGuest).toHaveBeenCalledTimes(1);
  expect(remote.startGuest.mock.calls[0]![0]).toMatch(/^[0-9a-f-]{36}$/);
  expect(remote.start).not.toHaveBeenCalled(); expect(remote.submit).not.toHaveBeenCalled();
  expect(remote.finish).not.toHaveBeenCalled();
});

it('queues distinct guest plays while an earlier count is awaiting acknowledgement', async () => {
  const local = storage(), remote = api(); let release!: () => void;
  remote.startGuest.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
  const controller = createRankingController(local, remote);
  expect(await controller.start('')).toBeNull(); expect(await controller.start('')).toBeNull();
  expect(remote.startGuest).toHaveBeenCalledTimes(1);
  release(); await controller.retry();
  expect(remote.startGuest).toHaveBeenCalledTimes(2);
  expect(new Set(remote.startGuest.mock.calls.map(args => args[0])).size).toBe(2);
  expect(remote.start).not.toHaveBeenCalled(); expect(remote.submit).not.toHaveBeenCalled();
});

it('retries an acknowledged guest with the same ID after a lost response and reload', async () => {
  const local = storage(), remote = api(), counted = new Set<string>();
  remote.startGuest.mockImplementationOnce(async id => { counted.add(id); throw new RankingError(true, 'response lost'); });
  remote.startGuest.mockImplementation(async id => { counted.add(id); });
  const controller = createRankingController(local, remote);
  await controller.start(''); await Promise.resolve(); await Promise.resolve();
  const original = remote.startGuest.mock.calls[0]![0];
  const reloaded = createRankingController(local, remote); await reloaded.retry();
  expect(remote.startGuest.mock.calls.map(args => args[0])).toEqual([original, original]);
  expect(counted.size).toBe(1);
  await reloaded.retry(); expect(remote.startGuest).toHaveBeenCalledTimes(2);
});

it('keeps failed guest counts separate from named scores and does not block named starts', async () => {
  const remote = api(); remote.startGuest.mockRejectedValue(new RankingError(true, 'offline'));
  const controller = createRankingController(storage(), remote);
  await controller.start(''); expect(await controller.start('テスト')).toEqual(play);
  controller.finish(play, 42, 'game_over'); await controller.retry();
  expect(remote.submit.mock.calls.map(args => args[0].score)).toEqual([42]);
  expect(controller.state()).toEqual({ status: 'submitted', pendingCount: 0 });
});

it('continues later guest counts after one permanently rejected count', async () => {
  const remote = api(); let reject!: (error: Error) => void;
  remote.startGuest.mockImplementationOnce(() => new Promise((_resolve, no) => { reject = no; }));
  const controller = createRankingController(storage(), remote);
  await controller.start(''); await controller.start('');
  reject(new RankingError(false, 'invalid')); await controller.retry();
  expect(remote.startGuest).toHaveBeenCalledTimes(2);
  await controller.retry(); expect(remote.startGuest).toHaveBeenCalledTimes(2);
});

it('sends guest count-only RPC fields and validates its acknowledgement', async () => {
  const calls: unknown[] = [];
  const client = createRankingClient(async (_input, init) => {
    calls.push(JSON.parse(String(init!.body)));
    return response({ accepted: true, start_id: startId, play_id: playId, game_slug: 'takkeu', client_version: RANKING_CONFIG.clientVersion });
  });
  await client.startGuest(startId);
  expect(calls).toEqual([{ p_start_id: startId, p_game_slug: 'takkeu', p_client_version: RANKING_CONFIG.clientVersion }]);
  const wrong = createRankingClient(async () => response({ accepted: true, start_id: submissionId, play_id: playId, game_slug: 'takkeu', client_version: RANKING_CONFIG.clientVersion }));
  await expect(wrong.startGuest(startId)).rejects.toMatchObject({ retryable: false });
});

it('preserves offline guest starts from two tabs that opened before either starts', async () => {
  const local = storage(), offlineA = api(), offlineB = api();
  offlineA.startGuest.mockRejectedValue(new RankingError(true, 'offline')); offlineB.startGuest.mockRejectedValue(new RankingError(true, 'offline'));
  const a = createRankingController(local, offlineA), b = createRankingController(local, offlineB);
  await a.start(''); await b.start(''); await Promise.resolve(); await Promise.resolve();
  const ids = [offlineA.startGuest.mock.calls[0]![0], offlineB.startGuest.mock.calls[0]![0]];
  const recovered = api(); await createRankingController(local, recovered).retry();
  expect(recovered.startGuest.mock.calls.map(args => args[0]).sort()).toEqual(ids.sort());
});

it('an acknowledgement in one tab cannot erase another tabs offline start', async () => {
  const local = storage(), first = api(), offline = api(); let release!: () => void;
  first.startGuest.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
  offline.startGuest.mockRejectedValue(new RankingError(true, 'offline'));
  const a = createRankingController(local, first), b = createRankingController(local, offline);
  await a.start(''); await b.start(''); await Promise.resolve(); await Promise.resolve();
  const otherId = offline.startGuest.mock.calls[0]![0];
  release(); await a.retry();
  const recovered = api(); await createRankingController(local, recovered).retry();
  expect(recovered.startGuest.mock.calls.some(args => args[0] === otherId)).toBe(true);
});

it('a new play requests a bounded follow-up drain when an older in-flight request fails', async () => {
  const remote = api(); let reject!: (reason: Error) => void;
  remote.startGuest.mockImplementationOnce(() => new Promise<void>((_ok, no) => { reject = no; }));
  const controller = createRankingController(storage(), remote);
  await controller.start(''); await controller.start('');
  reject(new RankingError(true, 'response lost')); await controller.retry();
  expect(remote.startGuest).toHaveBeenCalledTimes(3);
  const ids = remote.startGuest.mock.calls.map(args => args[0]);
  expect(ids[0]).toBe(ids[1]); expect(ids[2]).not.toBe(ids[0]);
});

it('reuses the start identifier after an ambiguous failure and across reloads', async () => {
  const local = storage(), remote = api();
  remote.start.mockRejectedValueOnce(new RankingError(true, 'offline'));
  const first = createRankingController(local, remote);
  await expect(first.start(' テスト ')).rejects.toThrow();
  const requestId = remote.start.mock.calls[0]![0];
  const reloaded = createRankingController(local, remote);
  await reloaded.start('テスト');
  expect(remote.start.mock.calls[1]).toEqual([requestId, 'テスト']);
  await reloaded.start('テスト');
  expect(remote.start.mock.calls[2]![0]).not.toBe(requestId);
});

it('finishes and submits once with stable identifiers after a lost response', async () => {
  const local = storage(), remote = api();
  remote.submit.mockRejectedValueOnce(new RankingError(true, 'lost response'));
  const controller = createRankingController(local, remote);
  controller.finish(play, 42, 'game_over');
  controller.finish(play, 42, 'game_over');
  await controller.retry();
  expect(controller.state().status).toBe('retryable_failed');
  const first = remote.submit.mock.calls[0]![0];
  const reloaded = createRankingController(local, remote);
  await reloaded.retry();
  expect(remote.submit.mock.calls[1]![0]).toEqual(first);
  expect(reloaded.state().status).toBe('submitted');
  expect(createRankingController(local, remote).state().pendingCount).toBe(0);
});

it('keeps an earlier failed result when a second play finishes and drains both in order', async () => {
  const local = storage(), remote = api();
  remote.finish.mockRejectedValueOnce(new RankingError(true, 'offline'));
  const controller = createRankingController(local, remote);
  controller.finish(play, 42, 'game_over'); await controller.retry();
  const next = { ...play, playId: '44444444-4444-4444-8444-444444444444' };
  controller.finish(next, 7, 'retire'); await controller.retry();
  expect(remote.submit.mock.calls.map(args => args[0].score)).toEqual([42, 7]);
  expect(controller.state().pendingCount).toBe(0);
});

it('coalesces simultaneous retries and still submits when saving is unavailable', async () => {
  const remote = api(); let release!: () => void;
  remote.finish.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
  const controller = createRankingController({ getItem: () => null, setItem: () => { throw Error('blocked'); } }, remote);
  controller.finish(play, 5, 'game_over');
  const first = controller.retry(), second = controller.retry();
  expect(remote.finish).toHaveBeenCalledTimes(1);
  release(); await Promise.all([first, second]);
  expect(remote.submit).toHaveBeenCalledTimes(1);
});

it('does not offer retries for a permanent server rejection', async () => {
  const remote = api(); remote.finish.mockRejectedValue(new RankingError(false, 'invalid score'));
  const controller = createRankingController(storage(), remote);
  controller.finish(play, 9, 'game_over'); await controller.retry();
  expect(controller.state().status).toBe('permanent_failed');
  await controller.retry(); expect(remote.finish).toHaveBeenCalledTimes(1);
});

it('uses bound fetch, no-store and the shared start/finish/submit contract', async () => {
  const replies = [acceptedStart, acceptedFinish, acceptedScore];
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const client = createRankingClient(async function (this: unknown, input, init) {
    expect(this).toBe(globalThis); calls.push({ url: String(input), init: init! });
    return response(replies.shift());
  });
  expect(await client.start(startId, 'テスト')).toEqual(play);
  await client.finish(pending); await client.submit(pending);
  expect(calls.map(call => call.url.split('/').at(-1))).toEqual(['start_game_play_v1', 'finish_game_play_v1', 'submit_score_idempotent_v1']);
  expect(calls.every(call => call.init.cache === 'no-store')).toBe(true);
  expect(JSON.parse(String(calls[1]!.init.body))).toMatchObject({ p_score: 42, p_result_type: 'game_over', p_play_id: playId });
});

it('rejects a successful HTTP response belonging to another play', async () => {
  const client = createRankingClient(async () => response({ ...acceptedStart, start_id: submissionId }));
  await expect(client.start(startId, 'テスト')).rejects.toMatchObject({ retryable: false });
});

it('rejects a score acknowledgement with mismatched identity or identifiers', async () => {
  const client = createRankingClient(async () => response([{ ...acceptedScore[0], result_submission_id: startId }]));
  await expect(client.submit(pending)).rejects.toMatchObject({ retryable: false });
});

it('classifies rate limits and times out after 8 seconds', async () => {
  const limited = createRankingClient(async () => response({ code: '42900' }, 400));
  await expect(limited.top()).rejects.toMatchObject({ retryable: true });
  vi.useFakeTimers();
  const client = createRankingClient(async (_input, init) => new Promise((_resolve, reject) => {
    init!.signal!.addEventListener('abort', () => reject(new DOMException('timeout', 'AbortError')));
  }));
  const result = expect(client.top()).rejects.toMatchObject({ retryable: true });
  await vi.advanceTimersByTimeAsync(8000); await result;
});

it('requests the best 30 and preserves server-provided tied ranks', async () => {
  const rows = [1, 1, 3].map((rank_no, index) => ({ rank_no, display_name: `名前${index}`, best_score: index < 2 ? 100 : 50, play_count: 2 }));
  const client = createRankingClient(async (_input, init) => {
    expect(JSON.parse(String(init!.body))).toEqual({ p_game_slug: 'takkeu', p_limit: 30 });
    return response(rows);
  });
  expect((await client.top()).map(row => row.rank)).toEqual([1, 1, 3]);
});

it('an older start response cannot erase a newer start retry identifier', async () => {
  const remote = api(); let resolveOld!: (value: typeof play) => void, rejectNew!: (error: Error) => void;
  remote.start.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  remote.start.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectNew = reject; }));
  const controller = createRankingController(storage(), remote);
  const old = controller.start('前の名前'), newer = controller.start('新しい名前');
  const newerId = remote.start.mock.calls[1]![0];
  resolveOld(play); await old;
  const failure = expect(newer).rejects.toThrow(); rejectNew(new RankingError(true, 'response lost')); await failure;
  await controller.start('新しい名前');
  expect(remote.start.mock.calls[2]![0]).toBe(newerId);
});

it('continues sending a later result after an older queued result is permanently rejected', async () => {
  const local = storage(), remote = api(); let rejectFirst!: (error: Error) => void;
  remote.finish.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectFirst = reject; }));
  const controller = createRankingController(local, remote);
  controller.finish(play, 42, 'game_over');
  controller.finish({ ...play, playId: '44444444-4444-4444-8444-444444444444' }, 7, 'game_over');
  rejectFirst(new RankingError(false, 'rejected')); await controller.retry();
  expect(remote.submit.mock.calls.map(args => args[0].score)).toEqual([7]);
  expect(controller.state()).toEqual({ status: 'permanent_failed', pendingCount: 1 });
  expect(createRankingController(local, remote).state().status).toBe('permanent_failed');
});

it('accepts a duplicate acknowledgement after the aggregate display spelling changed', async () => {
  const named = { ...pending, play: { ...play, displayName: 'Test', normalizedName: 'test' } };
  const client = createRankingClient(async () => response([{ ...acceptedScore[0], result_display_name: 'TEST', result_normalized_name: 'test', was_duplicate: true }]));
  await expect(client.submit(named)).resolves.toBeUndefined();
});
