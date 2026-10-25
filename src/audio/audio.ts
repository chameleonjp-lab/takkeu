import type { GameConfig, GameEvent } from '../game/types';
import type { Quality } from '../storage/preferences';
import { playMilestoneFanfare, playOpponentHit, playPlayerHit, playSmashSuccess, playSmashWarning } from './tones';
import type { Voice } from './tones';
type VoicePriority = 'hit' | 'warning' | 'fanfare';
export interface GameAudio { unlock(): Promise<boolean>; consume(events: readonly GameEvent[]): void; setVolume(value: number): void; setMuted(value: boolean): void; setQuality?(value: Quality): void; suspend(): void; reset(runId: string): void; dispose(): Promise<void> }
export function createAudio(config: GameConfig, contextFactory: () => AudioContext = () => new AudioContext(), onInterruption: () => void = () => {}, onUnavailable: () => void = () => {}): GameAudio {
  let context: AudioContext | null = null, output: GainNode | null = null, bus: AudioNode | null = null;
  const graph = new Set<AudioNode>();
  let runId = '', enabled = false, muted = false, disposed = false, volume = .65, generation = 0, quality: Quality = 'standard';
  let seenTime = -Infinity;
  const seen = new Set<string>(), voices = new Map<Voice, VoicePriority>(), retiring = new Map<Voice, VoicePriority>();
  const limit = Number.isFinite(config.audioVoiceLimit) ? Math.max(1, Math.min(8, Math.floor(config.audioVoiceLimit))) : 8;
  // Twice the former gain with up to `limit` voices. As fade tails overlap,
  // lower the gain to keep the sum below .8, including filter overshoot (.16).
  // Compression is additional shaping, never the peak bound.
  const quietly = (work: () => void) => { try { work(); } catch { /* Closing/partial graph. */ } };
  const clearVoices = (preserveFanfare = false) => {
    for (const [voice, priority] of [...voices, ...retiring]) {
      if (preserveFanfare && priority === 'fanfare') continue;
      voice.disconnect(); voices.delete(voice); retiring.delete(voice);
    }
  };
  const clearGraph = () => { for (const node of graph) quietly(() => node.disconnect()); graph.clear(); output = null; bus = null; };
  const setGain = () => {
    const headroom = Math.min(1, .8 / (Math.max(limit, voices.size + retiring.size) * .16));
    if (output) output.gain.value = muted ? 0 : volume * headroom;
  };
  const ended = (voice: Voice) => { voices.delete(voice); retiring.delete(voice); setGain(); };
  const startVoice = (play: typeof playPlayerHit, priority: VoicePriority, score: number) => {
    if (voices.size >= limit) {
      // Ordinary cues cannot interrupt a celebration. Among ordinary voices,
      // retain the existing hit-before-warning replacement order.
      const ordinary = [...voices.keys()].filter(voice => voices.get(voice) !== 'fanfare');
      const hits = ordinary.filter(voice => voices.get(voice) === 'hit');
      const candidates = hits.length ? hits : ordinary.length ? ordinary : priority === 'fanfare' ? [...voices.keys()] : [];
      const soonest = candidates.sort((a, b) => a.endsAt - b.endsAt)[0];
      if (!soonest) return;
      const previousPriority = voices.get(soonest)!;
      voices.delete(soonest); retiring.set(soonest, previousPriority); soonest.stop();
      if (retiring.size > limit) { const tail = retiring.keys().next().value!; tail.disconnect(); retiring.delete(tail); }
    }
    // Dense contacts reduce ornaments without shortening the fanfare phrase.
    const options = { score, quality: quality === 'low' || voices.size >= Math.ceil(limit / 2) ? 'low' as const : 'standard' as const };
    const voice = play(context!, bus!, ended, options);
    voices.set(voice, priority); setGain();
  };
  const buildGraph = (ctx: AudioContext) => {
    const own = <T extends AudioNode>(node: T): T => { graph.add(node); return node; };
    try {
      output = own(ctx.createGain()); setGain();
      // If compression is unsupported, tones still use their conservative bound.
      if (typeof ctx.createDynamicsCompressor === 'function') {
        const compressor = own(ctx.createDynamicsCompressor());
        compressor.threshold.value = -14; compressor.knee.value = 12; compressor.ratio.value = 4;
        compressor.attack.value = .002; compressor.release.value = .08;
        compressor.connect(output); bus = compressor;
      } else bus = output;
      output.connect(ctx.destination);
    } catch (error) { clearGraph(); throw error; }
  };
  return {
    async unlock() {
      if (disposed) return false;
      const current = ++generation;
      try {
        if (!context || context.state === 'closed') {
          if (context) context.onstatechange = null;
          clearVoices(); clearGraph(); context = contextFactory();
          const ctx = context;
          ctx.onstatechange = () => {
            if (context === ctx && enabled && ctx.state !== 'running') {
              generation++; enabled = false; clearVoices(); onInterruption();
            }
          };
        }
        const ctx = context;
        if (!output) buildGraph(ctx);
        await ctx.resume();
        if (current !== generation || disposed || context !== ctx) return false;
        enabled = ctx.state === 'running'; return enabled;
      } catch { if (current === generation) { enabled = false; clearVoices(); clearGraph(); } return false; }
    },
    consume(events) {
      if (disposed) return;
      for (const event of events) {
        if (event.runId !== runId || !Number.isFinite(event.time) || event.time < seenTime || (event.time === seenTime && seen.has(event.id))) continue;
        if (event.time > seenTime) { seen.clear(); seenTime = event.time; }
        seen.add(event.id);
        if (event.kind === 'game-over') { generation++; enabled = false; clearVoices(true); continue; }
        if (!enabled || muted || volume === 0 || !context || !bus || context.state !== 'running') continue;
        if (event.kind !== 'player-hit' && event.kind !== 'opponent-hit' && event.kind !== 'smash-warning') continue;
        try {
          const score = event.rallyScore ?? 0;
          const play = event.kind === 'player-hit' ? (event.smashReturn === true ? playSmashSuccess : playPlayerHit)
            : event.kind === 'smash-warning' ? playSmashWarning : playOpponentHit;
          startVoice(play, event.kind === 'smash-warning' ? 'warning' : 'hit', score);
          if (event.kind === 'player-hit' && Number.isSafeInteger(score) && score > 0 && score % 100 === 0) {
            startVoice(playMilestoneFanfare, 'fanfare', score);
          }
        } catch { enabled = false; clearVoices(); onUnavailable(); }
      }
    },
    setVolume(value) { if (Number.isFinite(value)) volume = Math.max(0, Math.min(1, value)); if (volume === 0) clearVoices(); setGain(); },
    setMuted(value) { muted = value; if (muted) clearVoices(); setGain(); },
    setQuality(value) { quality = value === 'low' ? 'low' : 'standard'; },
    suspend() {
      generation++; enabled = false; clearVoices();
      if (context && context.state !== 'closed') quietly(() => { void context!.suspend().catch(() => {}); });
    },
    reset(nextRunId) { generation++; runId = nextRunId; seenTime = -Infinity; seen.clear(); clearVoices(); },
    async dispose() {
      if (disposed) return; disposed = true; generation++; enabled = false; clearVoices(); clearGraph();
      const ctx = context; context = null;
      if (ctx) { ctx.onstatechange = null; if (ctx.state !== 'closed') { try { await ctx.close(); } catch { /* Already interrupted or closed. */ } } }
      seen.clear();
    },
  };
}
