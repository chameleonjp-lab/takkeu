import type { GameConfig, GameEvent } from '../game/types';
import { playOpponentHit, playPlayerHit, playSmashWarning } from './tones';
import type { Voice } from './tones';
export interface GameAudio { unlock(): Promise<boolean>; consume(events: readonly GameEvent[]): void; setVolume(value: number): void; setMuted(value: boolean): void; suspend(): void; reset(runId: string): void; dispose(): Promise<void> }
export function createAudio(config: GameConfig, contextFactory: () => AudioContext = () => new AudioContext(), onInterruption: () => void = () => {}): GameAudio {
  let context: AudioContext | null = null, output: GainNode | null = null;
  let runId = '', enabled = false, muted = false, disposed = false, volume = 0.65, generation = 0;
  // The simulation emits chronological events. Only IDs at the newest timestamp
  // need retaining; every older event is stale. History cannot grow with a run.
  let seenTime = -Infinity;
  const seen = new Set<string>(), voices = new Set<Voice>(), retiring = new Set<Voice>();
  const limit = Math.max(1, config.audioVoiceLimit);
  // At most limit active voices + limit 8ms fade tails, each peak <= .16.
  const headroom = Math.min(1, 0.85 / (2 * limit * 0.16));
  const clearVoices = (): void => { for (const voice of [...voices, ...retiring]) { voice.stop(); voice.disconnect(); } voices.clear(); retiring.clear(); };
  const setGain = (): void => { if (output) output.gain.value = muted ? 0 : volume * headroom; };
  const ended = (voice: Voice): void => { voices.delete(voice); retiring.delete(voice); };
  return {
    async unlock() {
      if (disposed) return false;
      const current = ++generation;
      try {
        if (!context || context.state === 'closed') {
          if (context) context.onstatechange = null;
          output?.disconnect(); context = contextFactory();
          output = null;
          context.onstatechange = () => {
            if (enabled && context?.state !== 'running') {
              generation++; enabled = false; clearVoices(); onInterruption();
            }
          };
        }
        if (!output) {
          const nextOutput = context.createGain();
          try { nextOutput.connect(context.destination); } catch (error) { nextOutput.disconnect(); throw error; }
          output = nextOutput; setGain();
        }
        await context.resume();
        if (current !== generation || disposed) return false;
        enabled = context.state === 'running'; return enabled;
      } catch { if (current === generation) { enabled = false; clearVoices(); } return false; }
    },
    consume(events) {
      if (disposed) return;
      for (const event of events) {
        if (event.runId !== runId || event.time < seenTime || (event.time === seenTime && seen.has(event.id))) continue;
        if (event.time > seenTime) { seen.clear(); seenTime = event.time; }
        seen.add(event.id);
        if (event.kind === 'game-over') { generation++; enabled = false; clearVoices(); continue; }
        if (!enabled || muted || !context || !output || context.state !== 'running') continue;
        if (event.kind !== 'player-hit' && event.kind !== 'opponent-hit' && event.kind !== 'smash-warning') continue;
        try {
          if (voices.size >= limit) {
            const soonest = [...voices].sort((a, b) => a.endsAt - b.endsAt)[0]!;
            voices.delete(soonest); soonest.stop(); retiring.add(soonest);
            if (retiring.size > limit) { const tail = retiring.values().next().value!; tail.disconnect(); retiring.delete(tail); }
          }
          const voice = event.kind === 'player-hit' ? playPlayerHit(context, output, ended)
            : event.kind === 'smash-warning' ? playSmashWarning(context, output, ended) : playOpponentHit(context, output, ended);
          voices.add(voice);
        } catch { enabled = false; clearVoices(); }
      }
    },
    setVolume(value) { if (Number.isFinite(value)) volume = Math.max(0, Math.min(1, value)); setGain(); },
    setMuted(value) { muted = value; if (muted) clearVoices(); setGain(); },
    suspend() {
      generation++; enabled = false; clearVoices();
      if (context && context.state !== 'closed') void context.suspend().catch(() => {});
    },
    reset(nextRunId) { generation++; runId = nextRunId; seenTime = -Infinity; seen.clear(); clearVoices(); },
    async dispose() {
      if (disposed) return; disposed = true; generation++; enabled = false; clearVoices(); output?.disconnect();
      if (context) { context.onstatechange = null; if (context.state !== 'closed') await context.close().catch(() => {}); }
      output = null; context = null; seen.clear();
    },
  };
}
