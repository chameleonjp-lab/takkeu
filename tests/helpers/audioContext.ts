export function fakeAudioContext(options: { failResume?: boolean } = {}) {
  const voices: { type: string; frequencies: number[]; stopped: boolean }[] = [];
  const param = (values: number[] = []) => ({ value: 1, setValueAtTime(value: number) { values.push(value); }, exponentialRampToValueAtTime(value: number) { values.push(value); }, linearRampToValueAtTime() {}, cancelScheduledValues() {} });
  const context = {
    currentTime: 0, state: 'suspended', destination: {},
    async resume() { if (options.failResume) throw new Error('Autoplay denied'); this.state = 'running'; },
    async suspend() { this.state = 'suspended'; }, async close() { this.state = 'closed'; },
    createGain() { return { gain: param(), connect() {}, disconnect() {} }; },
    createOscillator() {
      const voice = { type: 'sine', frequencies: [] as number[], stopped: false };
      voices.push(voice);
      return {
        frequency: param(voice.frequencies), onended: null,
        get type() { return voice.type; }, set type(type: string) { voice.type = type; },
        connect() {}, disconnect() {}, start() {},
        stop() { voice.stopped = true; },
      };
    },
  };
  return { context: context as unknown as AudioContext, voices };
}
