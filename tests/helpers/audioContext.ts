export function fakeAudioContext(options: { failResume?: boolean } = {}) {
  const voices: { type: string; frequencies: number[]; stopped: boolean; stops: number[]; ended: (() => void) | null; disconnected: boolean }[] = [];
  const ramps: number[] = [];
  const gains: { gain: { value: number } }[] = [];
  const param = (values: number[] = []) => ({ value: 1, setValueAtTime(value: number) { this.value = value; values.push(value); }, exponentialRampToValueAtTime(value: number) { values.push(value); }, linearRampToValueAtTime(value: number) { ramps.push(value); }, cancelScheduledValues() {}, cancelAndHoldAtTime() {} });
  const context = {
    currentTime: 0, state: 'suspended', destination: {}, onstatechange: null as (() => void) | null,
    async resume() { if (options.failResume) throw new Error('Autoplay denied'); this.state = 'running'; },
    async suspend() { this.state = 'suspended'; }, async close() { this.state = 'closed'; },
    createGain() { const gain = { gain: param(), connect() {}, disconnect() {} }; gains.push(gain); return gain; },
    createOscillator() {
      const voice = { type: 'sine', frequencies: [] as number[], stopped: false, stops: [] as number[], ended: null as (() => void) | null, disconnected: false };
      voices.push(voice);
      return {
        frequency: param(voice.frequencies), get onended() { return voice.ended; }, set onended(value: (() => void) | null) { voice.ended = value; },
        get type() { return voice.type; }, set type(type: string) { voice.type = type; },
        connect() {}, disconnect() { voice.disconnected = true; }, start() {},
        stop(time: number) { voice.stopped = true; voice.stops.push(time); },
      };
    },
  };
  return { context: context as unknown as AudioContext, voices, ramps, gains };
}

/** Full Web Audio double: scheduled starts/ends, node ownership and one-shot faults. */
export function layeredAudioContext(rate = 48000) {
  type NodeRecord = { kind: string; connected: boolean; disconnected: boolean; node: Record<string, any> };
  type SourceRecord = { kind: string; type: string; frequencies: number[]; starts: number[]; stops: number[]; ended: (() => void) | null; record: NodeRecord };
  const nodes: NodeRecord[] = [], sources: SourceRecord[] = [], curves: unknown[] = [], buffers: unknown[] = [];
  let operation = 0, failAt = -1;
  const check = () => { if (++operation === failAt) throw new Error(`audio fault ${operation}`); };
  const param = (values: number[] = []) => ({ value: 1, setValueAtTime(v: number) { check(); values.push(v); },
    exponentialRampToValueAtTime(v: number) { check(); values.push(v); }, linearRampToValueAtTime(v: number) { check(); values.push(v); },
    cancelScheduledValues() { check(); }, cancelAndHoldAtTime() { check(); } });
  const make = (kind: string) => {
    check();
    const record: NodeRecord = { kind, connected: false, disconnected: false, node: {} };
    record.node = { connect() { check(); record.connected = true; }, disconnect() { record.connected = false; record.disconnected = true; } };
    nodes.push(record); return record;
  };
  const source = (kind: string) => {
    const record = make(kind);
    const row: SourceRecord = { kind, type: 'sine', frequencies: [], starts: [], stops: [], ended: null, record };
    sources.push(row);
    Object.assign(record.node, { frequency: param(row.frequencies), start(time: number) { check(); row.starts.push(time); }, stop(time: number) { row.stops.push(time); } });
    Object.defineProperties(record.node, { type: { get: () => row.type, set: (v: string) => { check(); row.type = v; } },
      onended: { get: () => row.ended, set: (v: (() => void) | null) => { row.ended = v; } },
      buffer: { set: (v: unknown) => { check(); buffers.push(v); } } });
    return record.node;
  };
  const context = {
    currentTime: 0, sampleRate: rate, state: 'suspended', destination: {}, onstatechange: null as (() => void) | null,
    async resume() { check(); this.state = 'running'; }, async suspend() { this.state = 'suspended'; }, async close() { this.state = 'closed'; },
    createGain() { const row = make('gain'); return Object.assign(row.node, { gain: param() }); },
    createOscillator() { return source('oscillator'); }, createBufferSource() { return source('buffer'); },
    createBuffer(_channels: number, length: number) { check(); const data = new Float32Array(length); return { getChannelData() { return data; } }; },
    createWaveShaper() { const row = make('shaper'); Object.defineProperty(row.node, 'curve', { set(v) { check(); curves.push(v); } }); return row.node; },
    createBiquadFilter() { const row = make('filter'); return Object.assign(row.node, { frequency: param(), Q: param(), type: 'lowpass' }); },
    createDynamicsCompressor() { const row = make('compressor'); return Object.assign(row.node, { threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }); },
  };
  return { context: context as unknown as AudioContext, nodes, sources, curves, buffers,
    operations: () => operation, failNext(offset = 1) { failAt = operation + offset; },
    finish(index: number) { sources[index]?.ended?.(); }, finishAll() { for (const row of sources) row.ended?.(); } };
}
