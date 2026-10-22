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
  const liveVoices = new Set<OscillatorNode>(), Native = window.AudioContext;
  window.AudioContext = class extends Native {
    constructor() { super(); audioContexts++; }
    override createOscillator() {
      const voice = super.createOscillator(), start = voice.start.bind(voice), disconnect = voice.disconnect.bind(voice);
      voice.start = time => { liveVoices.add(voice); start(time); };
      voice.disconnect = () => { liveVoices.delete(voice); disconnect(); };
      return voice;
    }
  };
  Object.assign(window, { runtimeProbe: { counts: () => ({
    listeners: [...subscriptions.values()].reduce((n, types) => n + [...types.values()].reduce((s, set) => s + set.size, 0), 0),
    pendingFrames: pending.size, audioContexts,
  }), liveVoices: () => liveVoices.size } });
}
declare global { interface Window { runtimeProbe: { counts(): { listeners: number; pendingFrames: number; audioContexts: number }; liveVoices(): number } } }
