import { describe, expect, it } from 'vitest';
import { createAudio } from '../../src/audio/audio';
import * as tones from '../../src/audio/tones';
import { DEFAULT_CONFIG } from '../../src/game/config';
import type { GameEvent } from '../../src/game/types';
import { fakeAudioContext, layeredAudioContext } from '../helpers/audioContext';

const hit = (id: string, runId = 'run'): GameEvent => ({ kind: 'player-hit', id, runId, time: 0, ballId: 1 });
function recordBuffers(context: AudioContext) {
  const buffers: AudioBuffer[] = [], create = context.createBuffer.bind(context);
  context.createBuffer = (...args) => { const buffer = create(...args); buffers.push(buffer); return buffer; };
  return buffers;
}

describe('silent audio preparation', () => {
  it('calls resume during the initiating gesture and warms data without creating any source', async () => {
    const t = layeredAudioContext(), buffers = recordBuffers(t.context);
    let resumeCalls = 0;
    const resume = t.context.resume.bind(t.context);
    t.context.resume = () => { resumeCalls++; return resume(); };
    const audio = createAudio(DEFAULT_CONFIG, () => t.context);
    audio.reset('run');
    const preparing = audio.prepare!();
    expect(resumeCalls).toBe(1);
    expect(await preparing).toBe(true);
    expect(buffers).toHaveLength(1);
    expect(buffers[0]!.getChannelData(0)).toHaveLength(2400);
    expect(t.sources).toHaveLength(0);
    expect(t.nodes.map(node => node.kind).sort()).toEqual(['compressor', 'gain', 'gain']);
    audio.consume([hit('first')]);
    expect(t.sources.length).toBeGreaterThan(0);
    expect(t.buffers[0]).toBe(buffers[0]);
    expect(buffers).toHaveLength(1);
    await audio.dispose();
    expect(t.nodes.every(node => node.disconnected)).toBe(true);
  });

  it('shares the warmed noise and shaping curve with later tones without retaining a voice', () => {
    const t = layeredAudioContext(), buffers = recordBuffers(t.context);
    tones.prepareTones(t.context); tones.prepareTones(t.context);
    expect(buffers).toHaveLength(1);
    expect(t.nodes).toHaveLength(0);
    expect(t.sources).toHaveLength(0);
    const first = tones.playPlayerHit(t.context, t.context.destination);
    const second = tones.playOpponentHit(t.context, t.context.destination);
    expect(t.buffers).toHaveLength(2);
    expect(t.buffers.every(buffer => buffer === buffers[0])).toBe(true);
    expect(t.curves).toHaveLength(2);
    expect(t.curves[0]).toBe(t.curves[1]);
    expect(buffers).toHaveLength(1);
    first.disconnect(); second.disconnect();
    expect(t.nodes.every(node => node.disconnected)).toBe(true);
  });

  it('reuses its context, graph and synthesis data over repeated preparation and replay', async () => {
    const t = layeredAudioContext(), buffers = recordBuffers(t.context);
    let contexts = 0;
    const audio = createAudio(DEFAULT_CONFIG, () => { contexts++; return t.context; });
    for (let i = 0; i < 20; i++) {
      const runId = `run-${i}`;
      audio.reset(runId);
      expect(await audio.prepare!()).toBe(true);
      expect(await audio.prepare!()).toBe(true);
      expect(t.sources.filter(source => !source.record.disconnected)).toHaveLength(0);
      audio.consume([hit('first', runId)]); t.finishAll(); audio.suspend();
      expect(t.nodes.filter(node => !node.disconnected)).toHaveLength(3);
    }
    expect(contexts).toBe(1);
    expect(buffers).toHaveLength(1);
    expect(new Set(t.curves).size).toBe(1);
    expect(new Set(t.buffers).size).toBe(1);
    await audio.dispose();
    expect(t.nodes.every(node => node.disconnected)).toBe(true);
  });

  it('prepares silently while muted and does not replay events consumed while muted', async () => {
    const t = layeredAudioContext(), audio = createAudio(DEFAULT_CONFIG, () => t.context);
    audio.reset('run'); audio.setMuted(true);
    expect(await audio.prepare!()).toBe(true);
    expect(t.sources).toHaveLength(0);
    audio.consume([hit('muted')]); audio.setMuted(false); audio.consume([hit('muted')]);
    expect(t.sources).toHaveLength(0);
    audio.consume([hit('new')]); expect(t.sources.length).toBeGreaterThan(0);
    await audio.dispose();
  });

  it('uses basic oscillator fallback when reusable layered synthesis is unavailable', async () => {
    const t = fakeAudioContext(), audio = createAudio(DEFAULT_CONFIG, () => t.context);
    expect(() => tones.prepareTones(t.context)).not.toThrow();
    audio.reset('run'); expect(await audio.prepare!()).toBe(true);
    expect(t.voices).toHaveLength(0); expect(t.gains).toHaveLength(2);
    audio.consume([hit('first')]); expect(t.voices).toHaveLength(1);
    await audio.dispose();
  });

  it('returns false and cleans every partially created graph on preparation failure, then retries', async () => {
    const successful = layeredAudioContext(), first = createAudio(DEFAULT_CONFIG, () => successful.context);
    expect(await first.prepare!()).toBe(true);
    const operations = successful.operations(); await first.dispose();
    for (let offset = 1; offset <= operations; offset++) {
      const t = layeredAudioContext(); let unavailable = 0;
      const audio = createAudio(DEFAULT_CONFIG, () => t.context, () => {}, () => unavailable++);
      t.failNext(offset);
      expect(await audio.prepare!(), `fault ${offset}`).toBe(false);
      expect(t.nodes.every(node => node.disconnected), `fault ${offset}`).toBe(true);
      expect(t.sources, `fault ${offset}`).toHaveLength(0);
      expect(unavailable, `fault ${offset}`).toBe(0);
      expect(await audio.prepare!(), `retry ${offset}`).toBe(true);
      await audio.dispose();
      expect(t.nodes.every(node => node.disconnected), `disposed ${offset}`).toBe(true);
    }
  });

  it('reports unavailable audio only through its result during initial preparation', async () => {
    let unavailable = 0;
    const audio = createAudio(DEFAULT_CONFIG, () => { throw new Error('AudioContext unavailable'); }, () => {}, () => unavailable++);
    expect(await audio.prepare!()).toBe(false);
    expect(unavailable).toBe(0);
    expect(() => audio.consume([hit('first')])).not.toThrow();
    await audio.dispose();
  });

  it('returns false if resume settles without a running context', async () => {
    const t = layeredAudioContext(), audio = createAudio(DEFAULT_CONFIG, () => t.context);
    t.context.resume = async () => {};
    expect(await audio.prepare!()).toBe(false);
    audio.reset('run'); audio.consume([hit('first')]);
    expect(t.sources).toHaveLength(0);
    await audio.dispose(); expect(t.nodes.every(node => node.disconnected)).toBe(true);
  });

  it.each(['reset', 'suspend', 'mute', 'dispose'] as const)('ignores preparation that completes after %s', async action => {
    const t = layeredAudioContext(), buffers = recordBuffers(t.context);
    const audio = createAudio(DEFAULT_CONFIG, () => t.context);
    let complete!: () => void;
    t.context.resume = () => new Promise<void>(resolve => {
      complete = () => { Object.assign(t.context, { state: 'running' }); resolve(); };
    });
    audio.reset('run'); const pending = audio.prepare!();
    if (action === 'reset') audio.reset('next');
    else if (action === 'suspend') audio.suspend();
    else if (action === 'mute') { audio.setMuted(true); audio.setMuted(false); }
    else await audio.dispose();
    complete(); expect(await pending).toBe(false);
    audio.consume([hit('first', action === 'reset' ? 'next' : 'run')]);
    expect(t.sources).toHaveLength(0);
    expect(buffers).toHaveLength(0);
    await audio.dispose(); expect(t.nodes.every(node => node.disconnected)).toBe(true);
  });

  it('does not let an old rejected preparation clear newer prepared audio', async () => {
    const t = layeredAudioContext(), audio = createAudio(DEFAULT_CONFIG, () => t.context);
    let rejectOld!: (reason: Error) => void;
    const resume = t.context.resume.bind(t.context);
    t.context.resume = () => new Promise<void>((_, reject) => { rejectOld = reject; });
    audio.reset('run'); const old = audio.prepare!();
    audio.suspend(); t.context.resume = resume;
    expect(await audio.prepare!()).toBe(true);
    rejectOld(new Error('interrupted')); expect(await old).toBe(false);
    expect(t.nodes.filter(node => !node.disconnected)).toHaveLength(3);
    audio.consume([hit('first')]); expect(t.sources.length).toBeGreaterThan(0);
    await audio.dispose(); expect(t.nodes.every(node => node.disconnected)).toBe(true);
  });

  it('does not recreate an audio context after disposal', async () => {
    let contexts = 0;
    const t = layeredAudioContext(), audio = createAudio(DEFAULT_CONFIG, () => { contexts++; return t.context; });
    await audio.dispose(); expect(await audio.prepare!()).toBe(false);
    expect(contexts).toBe(0); expect(t.nodes).toHaveLength(0);
  });
});
