import type { GameConfig, GameEvent } from '../game/types';
import { playOpponentHit, playPlayerHit, playSmashWarning } from './tones';
import type { Voice } from './tones';
export interface GameAudio { unlock(): Promise<boolean>; consume(events: readonly GameEvent[]): void; setVolume(value: number): void; setMuted(value: boolean): void; suspend(): void; reset(runId: string): void; dispose(): Promise<void> }
export function createAudio(config: GameConfig, contextFactory: () => AudioContext = () => new AudioContext()): GameAudio {
  let context: AudioContext | null = null;
  let output: GainNode | null = null;
  let runId = '';
  let enabled = false;
  let muted = false;
  let volume = 0.65;
  let generation = 0;
  const seen = new Set<string>();
  const voices = new Set<Voice>();
  const clearVoices = (): void => { for (const voice of voices) { voice.stop(); voice.disconnect(); } voices.clear(); };
  const setGain = (): void => { if (output) output.gain.value = muted ? 0 : volume; };
  const ended = (voice: Voice): void => { voices.delete(voice); };
  return {
    async unlock() {
      const current = ++generation;
      try {
        if (!context || context.state === 'closed') {
          context = contextFactory();
          output = context.createGain(); output.connect(context.destination); setGain();
        }
        await context.resume();
        if (current !== generation) return false;
        enabled = context.state === 'running';
        return enabled;
      } catch { enabled = false; return false; }
    },
    consume(events) {
      for (const event of events) {
        if (event.runId !== runId || seen.has(event.id)) continue;
        seen.add(event.id);
        if (!enabled || muted || !context || !output || context.state !== 'running') continue;
        if (event.kind !== 'player-hit' && event.kind !== 'opponent-hit' && event.kind !== 'smash-warning') continue;
        if (voices.size >= config.audioVoiceLimit) {
          const oldest = voices.values().next().value;
          if (oldest) { oldest.stop(); voices.delete(oldest); }
        }
        const voice = event.kind === 'player-hit' ? playPlayerHit(context, output, ended)
          : event.kind === 'smash-warning' ? playSmashWarning(context, output, ended) : playOpponentHit(context, output, ended);
        voices.add(voice);
      }
    },
    setVolume(value) { if (Number.isFinite(value)) volume = Math.max(0, Math.min(1, value)); setGain(); },
    setMuted(value) { muted = value; setGain(); },
    suspend() {
      generation++; enabled = false; clearVoices();
      if (context && context.state !== 'closed') void context.suspend().catch(() => {});
    },
    reset(nextRunId) { generation++; runId = nextRunId; seen.clear(); clearVoices(); },
    async dispose() {
      generation++; enabled = false; clearVoices(); output?.disconnect();
      if (context && context.state !== 'closed') await context.close().catch(() => {});
      output = null; context = null;
    },
  };
}
