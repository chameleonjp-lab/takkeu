import { describe, expect, it } from 'vitest';
import { createAudio } from '../../src/audio/audio';
import { DEFAULT_CONFIG } from '../../src/game/config';
import type { GameEvent } from '../../src/game/types';
import { fakeAudioContext, layeredAudioContext } from '../helpers/audioContext';

const event = (score: number | undefined, id = String(score), kind: GameEvent['kind'] = 'player-hit', time = 0): GameEvent => ({
  kind, id, runId: 'run', time, ballId: 1, ...(score === undefined ? {} : { rallyScore: score }),
});
const longSources = (t: ReturnType<typeof layeredAudioContext>) => t.sources.filter(source => source.stops[0]! >= 1.5);

describe('rally milestone fanfare', () => {
  it.each([100, 200, 300, 10000])('plays a musical 1.5–2 second phrase at exact score %s', async score => {
    const t = layeredAudioContext(), audio = createAudio(DEFAULT_CONFIG, () => t.context);
    audio.reset('run'); await audio.unlock(); audio.consume([event(score)]);
    const finalNotes = longSources(t);
    expect(finalNotes.length).toBeGreaterThanOrEqual(3);
    expect(Math.max(...finalNotes.map(source => source.stops[0]!))).toBeLessThanOrEqual(2);
    expect(new Set(finalNotes.map(source => source.frequencies[0])).size).toBeGreaterThanOrEqual(3);
    expect(finalNotes.some(source => source.starts[0]! >= .5)).toBe(true);
    expect(t.sources.length).toBeLessThanOrEqual(20);
    t.finishAll(); expect(t.sources.every(source => source.record.disconnected)).toBe(true);
    await audio.dispose(); expect(t.nodes.every(node => node.disconnected)).toBe(true);
  });

  it.each([undefined, -100, 0, 99, 101, 100.5, NaN, Infinity])('does not infer a milestone from score %s', async score => {
    const t = layeredAudioContext(), audio = createAudio(DEFAULT_CONFIG, () => t.context);
    audio.reset('run'); await audio.unlock();
    audio.consume([event(score), event(100, 'opponent', 'opponent-hit'), event(200, 'warning', 'smash-warning')]);
    expect(longSources(t)).toHaveLength(0);
    await audio.dispose();
  });

  it('deduplicates exact milestone events and ignores old runs and times', async () => {
    const t = layeredAudioContext(), audio = createAudio(DEFAULT_CONFIG, () => t.context);
    audio.reset('run'); await audio.unlock();
    const milestone = event(100, 'hundred', 'player-hit', 1);
    audio.consume([milestone]); const count = t.sources.length;
    expect(longSources(t).length).toBeGreaterThan(0);
    audio.consume([milestone, { ...milestone, id: 'stale', time: 0 }, { ...milestone, id: 'old-run', runId: 'old' }]);
    expect(t.sources).toHaveLength(count);
    audio.consume([event(200, 'two-hundred', 'player-hit', 2)]);
    expect(t.sources.length).toBeGreaterThan(count);
    audio.reset('next');
    audio.consume([{ ...milestone, runId: 'next' }]);
    expect(longSources(t).some(source => !source.record.disconnected)).toBe(true);
    await audio.dispose();
  });

  it.each([1, 8])('protects an active fanfare from dense hits while allowing warnings with voice limit %s', async audioVoiceLimit => {
    const t = layeredAudioContext(), audio = createAudio({ ...DEFAULT_CONFIG, audioVoiceLimit }, () => t.context);
    audio.reset('run'); await audio.unlock(); audio.setVolume(1); audio.consume([event(100)]);
    const fanfare = longSources(t);
    expect(fanfare.length).toBeGreaterThan(0);
    for (let i = 0; i < 120; i++) {
      const warning = i % 3 === 0, before = t.sources.length;
      audio.consume([event(101, `dense-${i}`, warning ? 'smash-warning' : i % 2 === 0 ? 'player-hit' : 'opponent-hit')]);
      if (warning) expect(t.sources.slice(before).some(source => source.frequencies[0] === 850)).toBe(true);
      if (audioVoiceLimit > 1) expect(fanfare.every(source => source.stops.length === 1 && !source.record.disconnected)).toBe(true);
      else expect(fanfare.every(source => source.stops.length > 1)).toBe(true);
      const activeVoices = t.nodes.filter(node => node.kind === 'shaper' && !node.disconnected).length;
      expect(activeVoices).toBeLessThanOrEqual(audioVoiceLimit * 2);
      expect(t.sources.filter(source => !source.record.disconnected).length).toBeLessThanOrEqual(audioVoiceLimit * 20);
      expect((t.nodes[0]!.node.gain.value as number) * Math.max(audioVoiceLimit, activeVoices) * .16).toBeLessThanOrEqual(.8000000001);
    }
    await audio.dispose(); expect(t.nodes.every(node => node.disconnected)).toBe(true);
  });

  it('clears contact sounds at game-over and lets the existing fanfare finish naturally', async () => {
    const t = layeredAudioContext(), audio = createAudio(DEFAULT_CONFIG, () => t.context);
    audio.reset('run'); await audio.unlock();
    audio.consume([event(100), event(101, 'opponent', 'opponent-hit'), event(101, 'warning', 'smash-warning')]);
    const fanfare = longSources(t), count = t.sources.length;
    expect(fanfare.length).toBeGreaterThan(0);
    audio.consume([event(undefined, 'end', 'game-over'), event(200, 'after-end')]);
    expect(t.sources).toHaveLength(count);
    expect(fanfare.every(source => source.stops.length === 1 && !source.record.disconnected)).toBe(true);
    expect(t.sources.filter(source => !source.record.disconnected).every(source => source.kind === 'oscillator')).toBe(true);
    expect(t.sources.filter(source => source.kind === 'buffer').every(source => source.record.disconnected)).toBe(true);
    t.finishAll(); expect(t.sources.every(source => source.record.disconnected)).toBe(true);
    expect(t.nodes.filter(node => !node.disconnected)).toHaveLength(3);
    await audio.dispose();
  });

  it.each(['mute', 'zero-volume', 'suspend', 'reset', 'dispose'] as const)('stops all scheduled fanfare notes on %s', async action => {
    const t = layeredAudioContext(), audio = createAudio(DEFAULT_CONFIG, () => t.context);
    audio.reset('run'); await audio.unlock(); audio.consume([event(100)]);
    expect(longSources(t).length).toBeGreaterThan(0);
    if (action === 'mute') audio.setMuted(true);
    else if (action === 'zero-volume') audio.setVolume(0);
    else if (action === 'suspend') audio.suspend();
    else if (action === 'reset') audio.reset('next');
    else await audio.dispose();
    expect(t.sources.every(source => source.record.disconnected && source.ended === null)).toBe(true);
    await audio.dispose(); expect(t.nodes.every(node => node.disconnected)).toBe(true);
  });

  it('does not replay milestones consumed while muted, suspended or at zero volume', async () => {
    const t = layeredAudioContext(), audio = createAudio(DEFAULT_CONFIG, () => t.context);
    audio.reset('run'); await audio.unlock();
    audio.setMuted(true); audio.consume([event(100)]); audio.setMuted(false); audio.consume([event(100)]);
    audio.setVolume(0); audio.consume([event(200)]); audio.setVolume(.65); audio.consume([event(200)]);
    audio.suspend(); audio.consume([event(300)]); await audio.unlock(); audio.consume([event(300)]);
    expect(t.sources).toHaveLength(0);
    audio.consume([event(400)]); expect(longSources(t).length).toBeGreaterThan(0);
    await audio.dispose();
  });

  it('keeps the musical phrase when only basic oscillators are available', async () => {
    const t = fakeAudioContext(), audio = createAudio(DEFAULT_CONFIG, () => t.context);
    audio.reset('run'); await audio.unlock(); audio.consume([event(100)]);
    const finalNotes = t.voices.filter(source => source.stops[0]! >= 1.5);
    expect(finalNotes.length).toBeGreaterThanOrEqual(3);
    expect(Math.max(...finalNotes.map(source => source.stops[0]!))).toBeLessThanOrEqual(2);
    audio.setMuted(true); expect(t.voices.every(source => source.disconnected)).toBe(true);
    await audio.dispose();
  });

  it('owns every fanfare node through partial construction failures', async () => {
    const successful = layeredAudioContext(), first = createAudio(DEFAULT_CONFIG, () => successful.context);
    first.reset('run'); await first.unlock(); const start = successful.operations(); first.consume([event(100)]);
    expect(longSources(successful).length).toBeGreaterThan(0);
    const operations = successful.operations() - start; await first.dispose();
    for (let offset = 1; offset <= operations; offset++) {
      const t = layeredAudioContext(); let unavailable = 0;
      const audio = createAudio(DEFAULT_CONFIG, () => t.context, () => {}, () => unavailable++);
      audio.reset('run'); await audio.unlock(); t.failNext(offset);
      expect(() => audio.consume([event(100)])).not.toThrow();
      expect(unavailable, `fault ${offset}`).toBe(1);
      expect(t.sources.every(source => source.record.disconnected), `fault ${offset}`).toBe(true);
      await audio.dispose(); expect(t.nodes.every(node => node.disconnected), `fault ${offset}`).toBe(true);
    }
  });
});
