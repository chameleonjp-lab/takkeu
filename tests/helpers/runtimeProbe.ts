/** Install before the app; counts native subscriptions and pending frame callbacks. */
export function installRuntimeProbe() {
  const tracked = new Set(['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture', 'contextmenu', 'click', 'keydown', 'input', 'change', 'resize', 'orientationchange', 'blur', 'pagehide', 'visibilitychange', 'freeze', 'webglcontextlost', 'webglcontextrestored', 'webglcontextcreationerror']);
  const subscriptions = new Map<EventTarget, Map<string, Set<EventListenerOrEventListenerObject>>>();
  const add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (listener && tracked.has(type)) {
      let target = subscriptions.get(this); if (!target) { target = new Map(); subscriptions.set(this, target); }
      const key = `${type}:${typeof options === 'boolean' ? options : options?.capture ?? false}`;
      let listeners = target.get(key); if (!listeners) { listeners = new Set(); target.set(key, listeners); }
      listeners.add(listener);
    }
    return add.call(this, type, listener, options);
  };
  EventTarget.prototype.removeEventListener = function(type, listener, options) {
    const key = `${type}:${typeof options === 'boolean' ? options : options?.capture ?? false}`;
    if (listener) subscriptions.get(this)?.get(key)?.delete(listener);
    return remove.call(this, type, listener, options);
  };
  const pending = new Set<number>(), raf = requestAnimationFrame, cancel = cancelAnimationFrame;
  window.requestAnimationFrame = callback => {
    const id = raf(time => { pending.delete(id); callback(time); }); pending.add(id); return id;
  };
  window.cancelAnimationFrame = id => { pending.delete(id); cancel(id); };
  let audioContexts = 0;
  const liveVoices = new Set<WaveShaperNode>(), liveSources = new Set<AudioNode>(), Native = window.AudioContext;
  const source = <T extends AudioNode>(node: T): T => {
    liveSources.add(node); const disconnect = node.disconnect.bind(node);
    node.disconnect = () => { liveSources.delete(node); disconnect(); }; return node;
  };
  window.AudioContext = class extends Native {
    constructor() { super(); audioContexts++; }
    override createOscillator() {
      return source(super.createOscillator());
    }
    override createBufferSource() { return source(super.createBufferSource()); }
    override createWaveShaper() {
      // Exactly one shaper belongs to each full-quality OR low-quality voice.
      // Oscillators and noise buffers are sources inside that voice, not voices.
      const voice=super.createWaveShaper(), disconnect=voice.disconnect.bind(voice);
      liveVoices.add(voice); voice.disconnect=()=>{liveVoices.delete(voice);disconnect();};return voice;
    }
  };
  Object.assign(window, { runtimeProbe: { counts: () => ({
    listeners: [...subscriptions.values()].reduce((n, types) => n + [...types.values()].reduce((s, set) => s + set.size, 0), 0),
    pendingFrames: pending.size, audioContexts,
  }), liveVoices: () => liveVoices.size, liveSources: () => liveSources.size } });
}
declare global { interface Window { runtimeProbe: { counts(): { listeners: number; pendingFrames: number; audioContexts: number }; liveVoices(): number; liveSources(): number } } }
