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
