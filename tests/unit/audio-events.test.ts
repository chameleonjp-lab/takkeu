import { describe, expect, it } from 'vitest';
import { createAudio } from '../../src/audio/audio';
import { DEFAULT_CONFIG } from '../../src/game/config';
import type { GameEvent, GameEventKind } from '../../src/game/types';
import { fakeAudioContext } from '../helpers/audioContext';

const event = (kind: GameEventKind, id: string, runId = 'run-1'): GameEvent => ({ id, runId, kind, time: 0, ballId: 1 });
// This legacy double intentionally lacks layered Web Audio nodes: fallback coverage.
// Full-node path, bounds and fault injection live in layered-tones.test.ts.
describe('接触イベントから自他の音を生成（保守的な単音fallback）', () => {
  it('不可視に関係なく自他で異なる波形と高さを作り、同じ接触は一度だけ発音する', async () => {
    const { context, voices } = fakeAudioContext();
    const audio = createAudio(DEFAULT_CONFIG, () => context);
    audio.reset('run-1');
    expect(await audio.unlock()).toBe(true);
    audio.consume([event('player-hit', '1'), event('opponent-hit', '2'), event('player-hit', '1'), event('ball-lost', '3')]);
    expect(voices).toHaveLength(2);
    expect(voices[0]?.frequencies[0]).toBeGreaterThan(voices[1]!.frequencies[0]!);
    expect(voices[0]?.type).not.toBe(voices[1]?.type);
    await audio.dispose();
  });
  it('停止・消音中の音とリトライ前の古いイベントを捨てる', async () => {
    const { context, voices } = fakeAudioContext();
    const audio = createAudio(DEFAULT_CONFIG, () => context);
    audio.reset('run-1'); await audio.unlock();
    audio.consume([event('player-hit', '1')]);
    audio.suspend(); audio.consume([event('opponent-hit', '2')]);
    await audio.unlock();
    audio.consume([event('opponent-hit', '2')]);
    audio.setMuted(true); audio.consume([event('player-hit', '3')]);
    audio.setMuted(false); audio.consume([event('player-hit', '3')]);
    audio.reset('run-2');
    audio.consume([event('player-hit', 'old', 'run-1'), event('opponent-hit', 'new', 'run-2')]);
    expect(voices).toHaveLength(2);
    await audio.dispose();
  });
  it('音声を開始できなくても例外を残さず無音継続できる', async () => {
    const { context, voices } = fakeAudioContext({ failResume: true });
    const audio = createAudio(DEFAULT_CONFIG, () => context);
    audio.reset('run-1');
    expect(await audio.unlock()).toBe(false);
    expect(() => audio.consume([event('player-hit', '1')])).not.toThrow();
    expect(voices).toHaveLength(0);
    await audio.dispose();
  });
});

it('スマッシュの予告音は打球音と別に1回だけ鳴り、消音で音だけを捨てる', async () => {
  const { context, voices } = fakeAudioContext();
  const audio = createAudio(DEFAULT_CONFIG, () => context);
  audio.reset('run-1'); await audio.unlock();
  const warning = event('smash-warning', 'warn');
  audio.consume([warning, warning, event('opponent-hit', 'hit')]);
  expect(voices).toHaveLength(2);
  expect(voices[0]!.frequencies[1]).toBeGreaterThan(voices[0]!.frequencies[0]!);
  expect(voices[1]!.frequencies[0]).toBe(440);
  audio.setMuted(true); audio.consume([event('smash-warning', 'muted')]);
  expect(voices).toHaveLength(2);
  await audio.dispose();
});

it('4球を個別発音し、9音目では終了間近の音を短く消して切断する', async () => {
  const { context, voices, ramps } = fakeAudioContext();
  const audio = createAudio(DEFAULT_CONFIG, () => context); audio.reset('run-1'); await audio.unlock();
  // The shorter player voice ends before the older warning voice.
  audio.consume([event('smash-warning', 'w'), ...Array.from({ length: 7 }, (_, i) => event('player-hit', String(i)))]);
  expect(voices).toHaveLength(8);
  const naturalZeroRamps = ramps.filter(value => value === 0).length;
  audio.consume([event('opponent-hit', 'ninth')]);
  expect(voices).toHaveLength(9);
  // Natural stop is already scheduled for all voices; fade is observed via the gain ramp.
  // One new natural envelope reaches zero plus the replaced voice's fade.
  expect(ramps.filter(value => value === 0)).toHaveLength(naturalZeroRamps + 2);
  expect(voices[0]!.stops).toHaveLength(1);
  expect(voices[1]!.stops).toHaveLength(2);
  expect(voices[1]!.disconnected).toBe(false);
  voices[1]!.ended?.(); expect(voices[1]!.disconnected).toBe(true);
  audio.consume(Array.from({ length: 4 }, (_, i) => event('opponent-hit', `four-${i}`)));
  expect(voices).toHaveLength(13);
  await audio.dispose(); expect(voices.every(v => v.disconnected)).toBe(true);
});

it('ノード生成失敗をゲーム側へ投げず、次のユーザー操作で再試行できる', async () => {
  const { context } = fakeAudioContext();
  const original = context.createOscillator.bind(context);
  const audio = createAudio(DEFAULT_CONFIG, () => context); audio.reset('run-1'); await audio.unlock();
  context.createOscillator = () => { throw new Error('audio unavailable'); };
  expect(() => audio.consume([event('player-hit', '1')])).not.toThrow();
  context.createOscillator = original;
  expect(await audio.unlock()).toBe(true);
  await audio.dispose();
});

it('遅れて失敗した旧resumeが、新しいresumeの成功を取り消さない', async () => {
  const { context, voices } = fakeAudioContext();
  let rejectOld!: (reason: Error) => void;
  const resume = context.resume.bind(context);
  context.resume = () => new Promise<void>((_, reject) => { rejectOld = reject; });
  const audio = createAudio(DEFAULT_CONFIG, () => context); audio.reset('run-1');
  const old = audio.unlock(); audio.suspend(); context.resume = resume;
  expect(await audio.unlock()).toBe(true);
  rejectOld(new Error('interrupted')); expect(await old).toBe(false);
  audio.consume([event('player-hit', '1')]); expect(voices).toHaveLength(1);
  await audio.dispose();
});

it('ブラウザ側の音声中断を通知し、過去の音を復帰時に再生しない', async () => {
  const { context, voices } = fakeAudioContext(); let interruptions = 0;
  const audio = createAudio(DEFAULT_CONFIG, () => context, () => interruptions++);
  audio.reset('run-1'); await audio.unlock(); audio.consume([event('player-hit', '1')]);
  Object.assign(context, { state: 'interrupted' }); context.onstatechange?.(new Event('statechange'));
  expect(interruptions).toBe(1); expect(voices[0]!.disconnected).toBe(true);
  audio.consume([event('opponent-hit', '2')]); await audio.unlock(); audio.consume([event('opponent-hit', '2')]);
  expect(voices).toHaveLength(1); await audio.dispose();
});

it('出力ノードの初期化に一度失敗しても、次の操作で出力を作り直せる', async () => {
  const { context, voices } = fakeAudioContext();
  const gain = context.createGain.bind(context);
  context.createGain = () => { throw new Error('output unavailable'); };
  const audio = createAudio(DEFAULT_CONFIG, () => context); audio.reset('run-1');
  expect(await audio.unlock()).toBe(false);
  context.createGain = gain;
  expect(await audio.unlock()).toBe(true);
  audio.consume([event('player-hit', '1')]); expect(voices).toHaveLength(1);
  await audio.dispose();
});

it('音ノード生成失敗を画面側へ通知し、無音継続後に手動再試行できる', async () => {
  const { context, voices } = fakeAudioContext(); let unavailable = 0;
  const native = context.createOscillator.bind(context);
  const audio = createAudio(DEFAULT_CONFIG, () => context, () => {}, () => unavailable++);
  audio.reset('run-1'); await audio.unlock();
  context.createOscillator = () => { throw new Error('temporarily unavailable'); };
  expect(() => audio.consume([event('opponent-hit', '1')])).not.toThrow();
  expect(unavailable).toBe(1);
  context.createOscillator = native; audio.consume([event('player-hit', '2')]);
  expect(voices).toHaveLength(0);
  expect(await audio.unlock()).toBe(true);
  audio.consume([event('player-hit', '2'), event('opponent-hit', '3')]);
  expect(voices).toHaveLength(1); await audio.dispose();
});


it('47球の同時イベントも個別に一度だけ発音し、同時ノードは8音と8フェード尾以下に保つ', async () => {
  const { context, voices } = fakeAudioContext();
  const audio = createAudio(DEFAULT_CONFIG, () => context); audio.reset('run-1'); await audio.unlock();
  const burst = Array.from({ length: 47 }, (_, i) => ({ ...event(i % 2 ? 'player-hit' : 'opponent-hit', `burst-${i}`), ballId: i + 1 }));
  audio.consume(burst); audio.consume(burst);
  expect(voices).toHaveLength(47);
  expect(voices.filter(v => !v.disconnected).length).toBeLessThanOrEqual(16);
  audio.consume([event('game-over', 'end')]);
  expect(voices.every(v => v.disconnected)).toBe(true);
  audio.reset('run-2'); await audio.unlock(); audio.consume(burst);
  expect(voices).toHaveLength(47);
  await audio.dispose();
});
