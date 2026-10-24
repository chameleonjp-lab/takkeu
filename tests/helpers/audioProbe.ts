/** Counts actual native graph allocations; does not change audio or game clocks. */
export function installAudioProbe() {
  const live = new Set<AudioNode>(), sourceNodes = new Set<AudioNode>(), voiceNodes = new Set<AudioNode>();
  let created = 0, sourceCreated = 0, peakNodes = 0, peakSources = 0, peakVoices = 0;
  const Native = window.AudioContext;
  const instrument = (node: AudioNode, source = false, voice = false) => {
    live.add(node); if (source) { sourceNodes.add(node); sourceCreated++; } if (voice) voiceNodes.add(node);
    created++; peakNodes = Math.max(peakNodes, live.size); peakSources = Math.max(peakSources, sourceNodes.size); peakVoices = Math.max(peakVoices, voiceNodes.size);
    const disconnect = node.disconnect.bind(node);
    node.disconnect = () => { live.delete(node); sourceNodes.delete(node); voiceNodes.delete(node); disconnect(); };
    return node;
  };
  window.AudioContext = class extends Native {
    override createOscillator() { return instrument(super.createOscillator(), true) as OscillatorNode; }
    override createBufferSource() { return instrument(super.createBufferSource(), true) as AudioBufferSourceNode; }
    override createGain() { return instrument(super.createGain()) as GainNode; }
    override createWaveShaper() { return instrument(super.createWaveShaper(), false, true) as WaveShaperNode; }
    override createBiquadFilter() { return instrument(super.createBiquadFilter()) as BiquadFilterNode; }
    override createDynamicsCompressor() { return instrument(super.createDynamicsCompressor()) as DynamicsCompressorNode; }
  };
  Object.assign(window, { audioResources: () => ({ created, sourceCreated, liveNodes: live.size, liveSources: sourceNodes.size,
    // Each new layered voice has one shaper. Legacy voices have one oscillator.
    layeredVoices: voiceNodes.size, peakNodes, peakSources, peakVoices }) });
}
declare global { interface Window { audioResources(): { created: number; sourceCreated: number; liveNodes: number; liveSources: number; layeredVoices: number; peakNodes: number; peakSources: number; peakVoices: number } } }
