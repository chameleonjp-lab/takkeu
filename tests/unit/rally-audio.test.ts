import { describe, expect, it, vi } from 'vitest';
import { createAudio } from '../../src/audio/audio';
import { DEFAULT_CONFIG } from '../../src/game/config';
import type { GameEvent } from '../../src/game/types';
import { fakeAudioContext, layeredAudioContext } from '../helpers/audioContext';

const hit = (score: number, id = String(score), time = 0): GameEvent => ({ kind: 'player-hit', id, runId: 'run', time, ballId: 1, rallyScore: score });
const cue = (kind: 'best-record' | 'loss-impact', id: string = kind, time = 0) => ({ kind, id, runId: 'run', time });
const boot = async (audioVoiceLimit = 8) => {
  const t = layeredAudioContext(), audio = createAudio({ ...DEFAULT_CONFIG, audioVoiceLimit }, () => t.context);
  audio.reset('run'); await audio.unlock(); return { t, audio };
};
const phrase = (t: ReturnType<typeof layeredAudioContext>) => t.sources.filter(source => source.stops[0]! > .5);

describe('extended rally audio', () => {
  it.each([1000, 3000, 4000])('replaces the ordinary hundred phrase at %s with a distinct longer cue exactly once', async score => {
    const { t, audio } = await boot(); audio.consume([hit(score)]);
    const notes = phrase(t), count = t.sources.length;
    expect(notes.length).toBeGreaterThanOrEqual(4);
    expect(Math.max(...notes.map(source => source.stops[0]!))).toBeGreaterThan(2);
    expect(notes.some(source => source.starts[0] === .66 && source.frequencies[0] === 523.25)).toBe(false);
    audio.consume([hit(score)]); expect(t.sources).toHaveLength(count);
    await audio.dispose(); expect(t.nodes.every(node => node.disconnected)).toBe(true);
  });

  it('keeps 2000 ordinary and gives 1000, 3000 and 4000 different musical contours', async () => {
    const contours: number[][] = [];
    for (const score of [1000, 2000, 3000, 4000]) {
      const { t, audio } = await boot(); audio.consume([hit(score)]);
      const notes = phrase(t); contours.push(notes.map(source => source.frequencies[0]!));
      if (score === 2000) {
        expect(Math.max(...notes.map(source => source.stops[0]!))).toBeCloseTo(1.8);
        expect(notes.filter(source => source.starts[0] === .66)).toHaveLength(4);
      }
      await audio.dispose();
    }
    expect(new Set(contours.map(values => values.join(','))).size).toBe(4);
  });

  it('plays a confirmed best once per run and does not replay consumed silent achievements', async () => {
    const { t, audio } = await boot();
    expect(typeof audio.consumeAchievement).toBe('function');
    audio.consumeAchievement!(cue('best-record')); const first = t.sources.length;
    expect(first).toBeGreaterThan(0);
    audio.consumeAchievement!(cue('best-record', 'later', 1)); expect(t.sources).toHaveLength(first);
    audio.reset('next'); audio.setMuted(true);
    const next = { ...cue('best-record'), runId: 'next' };
    audio.consumeAchievement!(next); audio.setMuted(false); audio.consumeAchievement!(next);
    audio.consumeAchievement!({ ...next, id: 'another', time: 1 }); expect(t.sources).toHaveLength(first);
    audio.reset('third'); audio.consumeAchievement!({ ...next, runId: 'third' }); expect(t.sources.length).toBeGreaterThan(first);
    await audio.dispose();
  });

  it('plays bounded low impact only for unique, current confirmed loss groups', async () => {
    const { t, audio } = await boot(); expect(typeof audio.consumeAchievement).toBe('function');
    audio.consumeAchievement!(cue('loss-impact', 'fourth', 2)); const count = t.sources.length;
    expect(count).toBeGreaterThan(0); expect(count).toBeLessThanOrEqual(3);
    expect(t.sources.every(source => source.stops[0]! <= .3)).toBe(true);
    expect(Math.max(...t.sources.flatMap(source => source.frequencies))).toBeLessThan(300);
    audio.consumeAchievement!(cue('loss-impact', 'fourth', 2));
    audio.consumeAchievement!({ ...cue('loss-impact', 'old-run', 3), runId: 'old' });
    audio.consumeAchievement!(cue('loss-impact', 'old-time', 1));
    expect(t.sources).toHaveLength(count);
    audio.consumeAchievement!(cue('loss-impact', 'eighth', 4)); expect(t.sources.length).toBeGreaterThan(count);
    await audio.dispose();
  });

  it.each([1, 8])('keeps a warning audible when every live voice is a dedicated fanfare, limit %s', async limit => {
    const { t, audio } = await boot(limit);
    for (let i = 0; i < limit; i++) audio.consume([hit([1000, 3000, 4000][i % 3]!, `fanfare-${i}`)]);
    const before = t.sources.length;
    audio.consume([{ kind: 'smash-warning', id: 'warning', runId: 'run', time: 0, ballId: 1 }]);
    const warning = t.sources.slice(before);
    expect(warning.length).toBeGreaterThanOrEqual(3);
    expect(warning.some(source => source.frequencies[0] === 850)).toBe(true);
    for (let i = 0; i < 64; i++) audio.consume([{ kind: 'smash-warning', id: `warning-${i}`, runId: 'run', time: 0 }]);
    expect(t.nodes.filter(node => node.kind === 'shaper' && !node.disconnected).length).toBeLessThanOrEqual(limit * 2);
    await audio.dispose(); expect(t.nodes.every(node => node.disconnected)).toBe(true);
  });

  it('ducks only the fanfare bus smoothly while a warning sounds and recovers afterwards', async () => {
    const { t, audio } = await boot();
    const bus = t.nodes[2];
    expect(bus?.kind).toBe('gain');
    const ramp = vi.spyOn(bus!.node.gain, 'linearRampToValueAtTime');
    audio.consume([hit(1000), { kind: 'smash-warning', id: 'duck', runId: 'run', time: 0 }]);
    expect(ramp).toHaveBeenCalledWith(.2, .015);
    expect(ramp).toHaveBeenCalledWith(1, expect.closeTo(.359, 6));
    expect(t.nodes[0]!.node.gain.value).toBeGreaterThan(0);
    await audio.dispose();
  });

  it('preserves an active warning against a new fanfare when only one voice fits', async () => {
    const { t, audio } = await boot(1);
    audio.consume([{ kind: 'smash-warning', id: 'first-warning', runId: 'run', time: 0 }]);
    const warning = t.sources.slice();
    audio.consume([hit(1000)]);
    expect(warning.every(source => source.stops.length === 1 && !source.record.disconnected)).toBe(true);
    await audio.dispose();
  });

  it('clears prior warning duck automation when a run resets', async () => {
    const { t, audio } = await boot();
    const bus = t.nodes[2]!;
    const cancel = vi.spyOn(bus.node.gain, 'cancelScheduledValues');
    const set = vi.spyOn(bus.node.gain, 'setValueAtTime');
    audio.consume([{ kind: 'smash-warning', id: 'old-warning', runId: 'run', time: 0 }]);
    audio.reset('next');
    expect(cancel).toHaveBeenCalledWith(0);
    expect(set).toHaveBeenCalledWith(1, 0);
    await audio.dispose();
  });

  it('keeps duck ramps continuous when cancelAndHoldAtTime is unavailable', async () => {
    const { t, audio } = await boot();
    const gain = t.nodes[2]!.node.gain;
    delete gain.cancelAndHoldAtTime;
    const set = vi.spyOn(gain, 'setValueAtTime');
    audio.consume([{ kind: 'smash-warning', id: 'warning-a', runId: 'run', time: 0 }]);
    Object.assign(t.context, { currentTime: .005 });
    audio.consume([{ kind: 'smash-warning', id: 'warning-b', runId: 'run', time: .005 }]);
    expect(set).toHaveBeenCalledWith(expect.closeTo(.7333333333, 6), .005);
    await audio.dispose();
  });

  it('lets the final confirmed loss impact finish through same-time game over while clearing contacts', async () => {
    const { t, audio } = await boot();
    audio.consume([hit(99, 'contact', 2)]); const contacts = t.sources.slice();
    audio.consumeAchievement!(cue('loss-impact', 'loss-100', 2)); const impact = t.sources.slice(contacts.length);
    expect(impact).toHaveLength(2);
    audio.consume([{ kind: 'ball-lost', id: 'loss-100', runId: 'run', time: 2, ballId: 1 }, { kind: 'game-over', id: 'end', runId: 'run', time: 2 }]);
    expect(contacts.every(source => source.record.disconnected)).toBe(true);
    expect(impact.every(source => !source.record.disconnected && source.stops.length === 1)).toBe(true);
    expect(Math.max(...impact.map(source => source.stops[0]!))).toBeCloseTo(.24);
    const count = t.sources.length;
    audio.consumeAchievement!(cue('loss-impact', 'after-end', 3)); expect(t.sources).toHaveLength(count);
    t.finishAll(); expect(t.sources.every(source => source.record.disconnected)).toBe(true);
    expect(t.nodes.filter(node => !node.disconnected)).toHaveLength(3);
    await audio.dispose(); expect(t.nodes.every(node => node.disconnected)).toBe(true);
  });

  it.each(['best-record', 'loss-impact'] as const)('respects zero volume, pause, and run reset for %s', async kind => {
    const { t, audio } = await boot(); expect(typeof audio.consumeAchievement).toBe('function');
    audio.setVolume(0); audio.consumeAchievement!(cue(kind)); audio.setVolume(.65); audio.consumeAchievement!(cue(kind));
    expect(t.sources).toHaveLength(0);
    audio.reset('run'); audio.suspend(); audio.consumeAchievement!(cue(kind)); await audio.unlock(); audio.consumeAchievement!(cue(kind));
    expect(t.sources).toHaveLength(0);
    audio.reset('run'); audio.consumeAchievement!(cue(kind)); expect(t.sources.length).toBeGreaterThan(0);
    audio.setMuted(true); expect(t.sources.every(source => source.record.disconnected)).toBe(true);
    await audio.dispose();
  });

  it('preserves dedicated phrases with basic oscillator fallback and low quality', async () => {
    const t = fakeAudioContext(), audio = createAudio(DEFAULT_CONFIG, () => t.context);
    audio.reset('run'); await audio.unlock(); audio.setQuality!('low'); audio.consume([hit(4000)]);
    expect(Math.max(...t.voices.flatMap(source => source.stops))).toBeGreaterThan(2);
    expect(t.voices.length).toBeLessThanOrEqual(20);
    await audio.dispose(); expect(t.voices.every(source => source.disconnected)).toBe(true);
  });
});
