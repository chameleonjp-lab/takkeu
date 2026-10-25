import type { Quality } from '../storage/preferences';

export type Voice = { readonly endsAt: number; readonly sourceCount: number; stop(): void; disconnect(): void };
export type ToneOptions = { score?: number; quality?: Quality };
type Ended = (voice: Voice) => void;
type Layer = { type: OscillatorType | 'noise'; high: number; low: number; duration: number; peak: number; delay?: number; attack?: number; hold?: number };
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16] as const;
export function audioStage(score = 0): { semitones: number; accents: number } {
  const rally = Number.isSafeInteger(score) && score >= 0 ? score : 0;
  return { semitones: SCALE[Math.min(SCALE.length - 1, Math.floor(rally / 5))]!, accents: rally >= 10 ? 2 : rally >= 5 ? 1 : 0 };
}

// Weak keys never retain an abandoned context. Neither cached value refers to it.
const caches = new WeakMap<BaseAudioContext, { noise: AudioBuffer; curve: Float32Array<ArrayBuffer> }>();
function cache(context: BaseAudioContext) {
  let value = caches.get(context);
  if (!value) {
    const noise = context.createBuffer(1, Math.ceil(context.sampleRate * .05), context.sampleRate);
    const data = noise.getChannelData(0);
    let seed = 0x54a33; // Audio-only noise; never consumes the simulation's PRNG.
    for (let i = 0; i < data.length; i++) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; data[i] = (seed >>> 0) / 0x80000000 - 1; }
    const curve = new Float32Array(2049);
    for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(3 * (2 * i / (curve.length - 1) - 1));
    value = { noise, curve }; caches.set(context, value);
  }
  return value;
}
function supported(context: BaseAudioContext): boolean {
  return ['createWaveShaper', 'createBiquadFilter', 'createBufferSource', 'createBuffer', 'createDynamicsCompressor'].every(key => typeof (context as unknown as Record<string, unknown>)[key] === 'function');
}
/** Warm reusable synthesis data without allocating or scheduling any voice. */
export function prepareTones(context: BaseAudioContext): void {
  if (supported(context)) cache(context);
}
const quiet = (work: () => void): void => { try { work(); } catch { /* Already ended/closed or partial construction. */ } };

/** Every created node is owned immediately; every source completes independently. */
function synth(context: BaseAudioContext, output: AudioNode, layers: readonly Layer[], onEnded: Ended, layered: boolean): Voice {
  const nodes = new Set<AudioNode>();
  const sources = new Map<AudioScheduledSourceNode, AudioNode[]>();
  const now = context.currentTime;
  let mix: GainNode | undefined, envelope: GainNode | undefined, complete = false, stopping = false;
  const own = <T extends AudioNode>(node: T): T => { nodes.add(node); return node; };
  const remove = (node: AudioNode) => { quiet(() => node.disconnect()); nodes.delete(node); };
  const finish = () => {
    if (complete) return;
    complete = true;
    for (const node of nodes) quiet(() => node.disconnect());
    nodes.clear(); onEnded(voice);
  };
  const voice: Voice = {
    endsAt: now + Math.max(...layers.map(l => (l.delay ?? 0) + l.duration)), sourceCount: layers.length,
    stop() {
      if (stopping || complete) return;
      stopping = true;
      // All layers pass through this envelope, including sources not started yet.
      // Gain stays at a fixed value until this one replacement fade.
      if (envelope) quiet(() => {
        envelope!.gain.cancelScheduledValues(context.currentTime);
        envelope!.gain.setValueAtTime(layered ? .12 : 1, context.currentTime);
        envelope!.gain.linearRampToValueAtTime(0, context.currentTime + .008);
      });
      for (const source of sources.keys()) quiet(() => source.stop(context.currentTime + .008));
    },
    disconnect() {
      if (complete) return;
      for (const source of sources.keys()) { source.onended = null; quiet(() => source.stop(context.currentTime)); }
      sources.clear(); finish();
    },
  };
  try {
    // Cache allocation can fail, but cannot leave partially constructed nodes.
    const data = layered ? cache(context) : undefined;
    mix = own(context.createGain());
    envelope = own(context.createGain()); envelope.gain.value = layered ? .12 : 1;
    if (layered) {
      const shaper = own(context.createWaveShaper()); shaper.curve = data!.curve; shaper.oversample = '2x';
      const filter = own(context.createBiquadFilter()); filter.type = 'lowpass'; filter.Q.value = .5;
      filter.frequency.value = Math.min(6000, context.sampleRate * .2);
      mix.connect(shaper); shaper.connect(filter); filter.connect(envelope);
    } else mix.connect(envelope);
    envelope.connect(output);
    const frequency = (hz: number) => Math.max(25, Math.min(hz, 7000, (context.sampleRate || 44100) * .18));
    for (const layer of layers) {
      // Register the source before creating its envelope, wiring or scheduling.
      const source = own(layer.type === 'noise' ? context.createBufferSource() : context.createOscillator());
      const owned: AudioNode[] = [source]; sources.set(source, owned);
      source.onended = () => {
        if (complete || !sources.has(source)) return;
        source.onended = null; sources.delete(source);
        for (const node of owned) remove(node);
        if (!sources.size) finish();
      };
      const gain = own(context.createGain()); owned.push(gain);
      const start = now + (layer.delay ?? 0), end = start + layer.duration;
      if (layer.type === 'noise') {
        (source as AudioBufferSourceNode).buffer = data!.noise;
        const band = own(context.createBiquadFilter()); owned.push(band); band.type = 'bandpass'; band.Q.value = .7;
        band.frequency.value = frequency(layer.high);
        source.connect(band); band.connect(gain);
      } else {
        const oscillator = source as OscillatorNode; oscillator.type = layer.type;
        oscillator.frequency.setValueAtTime(frequency(layer.high), start);
        oscillator.frequency.exponentialRampToValueAtTime(frequency(layer.low), end);
        source.connect(gain);
      }
      gain.gain.setValueAtTime(0, now);
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.linearRampToValueAtTime(layer.peak, start + (layer.attack ?? .003));
      if (layer.hold !== undefined) gain.gain.setValueAtTime(layer.peak, start + layer.hold);
      gain.gain.exponentialRampToValueAtTime(.0001, end - .002);
      gain.gain.linearRampToValueAtTime(0, end);
      gain.connect(mix); source.start(start); source.stop(end);
    }
    return voice;
  } catch (error) { voice.disconnect(); throw error; }
}

function play(context: BaseAudioContext, output: AudioNode, kind: 'player' | 'opponent' | 'warning' | 'success', onEnded: Ended, options: ToneOptions): Voice {
  if (!supported(context)) {
    // Conservative single-source fallback, including browsers missing compression.
    const spec = kind === 'opponent' ? { type:'sine', high:440, low:220, duration:.085 }
      : kind === 'warning' ? { type:'triangle', high:660, low:1320, duration:.12 }
      : kind === 'success' ? { type:'triangle', high:1500, low:800, duration:.09 }
      : { type:'triangle', high:1150, low:700, duration:.055 };
    return synth(context, output, [{ ...spec, type:spec.type as OscillatorType, peak:.08 }], onEnded, false);
  }
  const stage = audioStage(options.score), pitch = Math.pow(2, stage.semitones / 12), low = options.quality === 'low';
  const layer = (type: Layer['type'], high: number, to: number, duration: number, peak: number, delay = 0): Layer => ({ type, high, low:to, duration, peak, delay });
  let layers: Layer[];
  if (kind === 'warning') {
    // 159ms total: sustain the rising cue at conservative peaks. The former
    // 60ms decays fell below the existing warning-energy check in both engines.
    layers = [0, .042, .084].map((delay,i) => layer('triangle', 850 + i * 300, 1250 + i * 400, .075, .18, delay));
    layers.push(layer('noise', 3800, 3800, .025, .12));
  } else if (kind === 'opponent') {
    layers = [layer('sine',200,50,.09,.5), layer('triangle',680,220,.07,.22), layer('square',330,110,.035,.08), layer('noise',1300,1300,.025,.18)];
    if (low) layers.splice(2,1);
  } else {
    const smash = kind === 'success';
    layers = [layer('sine',smash?300:260,smash?38:55,smash?.15:.09,.55),
      layer('triangle',(smash?1850:1400)*pitch,(smash?900:520)*pitch,smash?.09:.05,.28)];
    if (!low) layers.push(layer('sawtooth',(smash?1838:1420)*pitch,(smash?850:525)*pitch,.045,.1));
    if (smash && !low) layers.push(layer('sine',2325*pitch,1100*pitch,.08,.18));
    layers.push(layer('noise',smash?2400:1800,1800,.03,.22));
    const count = low ? (smash?2:1) : 3 + stage.accents;
    for (let i=0;i<count;i++) {
      layers.push(layer('sine',(2100+i*460)*pitch,(2200+i*460)*pitch,smash?.07:.035, .12/(1+i*.2), (smash?.015:.012)+i*(smash?.015:.012)));
    }
  }
  return synth(context, output, layers, onEnded, true);
}
export const playPlayerHit = (context: BaseAudioContext, output: AudioNode, onEnded: Ended = () => {}, options: ToneOptions = {}) => play(context, output, 'player', onEnded, options);
export const playOpponentHit = (context: BaseAudioContext, output: AudioNode, onEnded: Ended = () => {}, options: ToneOptions = {}) => play(context, output, 'opponent', onEnded, options);
export const playSmashWarning = (context: BaseAudioContext, output: AudioNode, onEnded: Ended = () => {}, options: ToneOptions = {}) => play(context, output, 'warning', onEnded, options);
export const playSmashSuccess = (context: BaseAudioContext, output: AudioNode, onEnded: Ended = () => {}, options: ToneOptions = {}) => play(context, output, 'success', onEnded, options);

/** A rising C-major brass phrase resolving to a held chord; one owned Voice. */
export function playMilestoneFanfare(context: BaseAudioContext, output: AudioNode, onEnded: Ended = () => {}, options: ToneOptions = {}): Voice {
  const layered = supported(context), low = options.quality === 'low';
  const note = (hz: number, delay: number, duration: number, chord = false): Layer => ({
    type: layered ? 'sawtooth' : 'triangle', high: hz, low: hz, delay, duration,
    // The layered shaper/envelope has the same .16 conservative voice bound as
    // contact sounds. Basic oscillators sum to <.08, including note overlap.
    peak: layered ? (chord ? .12 : .24) : (chord ? .018 : .022),
    attack: .018, hold: chord ? .5 : .07,
  });
  const layers = [note(523.25, 0, .16), note(659.25, .18, .16), note(783.99, .36, .26),
    ...[523.25, 659.25, 783.99].map(hz => note(hz, .66, 1.14, true))];
  if (layered && !low) layers.push({ ...note(1046.5, .66, 1.14, true), type: 'triangle', peak: .1 });
  return synth(context, output, layers, onEnded, layered);
}
