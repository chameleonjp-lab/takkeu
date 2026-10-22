import { describe, expect, it } from 'vitest';
import { createAudio } from '../../src/audio/audio';
import { DEFAULT_CONFIG } from '../../src/game/config';
import type { GameEvent, GameEventKind } from '../../src/game/types';
import { fakeAudioContext } from '../helpers/audioContext';

const event = (kind: GameEventKind, id: string, runId = 'run-1'): GameEvent => ({ id, runId, kind, time: 0, ballId: 1 });
describe('接触イベントから自他の音を生成', () => {
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
