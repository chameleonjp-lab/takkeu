export type Voice = { readonly endsAt: number; stop(): void; disconnect(): void };

function tone(context: AudioContext, output: AudioNode, type: OscillatorType, high: number, low: number, duration: number, peak: number, onEnded: (voice: Voice) => void): Voice {
  const oscillator = context.createOscillator();
  let envelope: GainNode;
  try { envelope = context.createGain(); } catch (error) { oscillator.disconnect(); throw error; }
  const now = context.currentTime;
  let stopping = false, disconnected = false;
  const voice: Voice = {
    endsAt: now + duration,
    stop() {
      if (stopping || disconnected) return; stopping = true;
      try {
        const time = context.currentTime;
        if (typeof envelope.gain.cancelAndHoldAtTime === 'function') envelope.gain.cancelAndHoldAtTime(time);
        else {
          const elapsed = Math.max(0, time - now);
          const value = elapsed < 0.003 ? 0.0001 + (peak - 0.0001) * elapsed / 0.003
            : peak * Math.pow(0.0001 / peak, Math.min(1, (elapsed - 0.003) / (duration - 0.003)));
          envelope.gain.cancelScheduledValues(time); envelope.gain.setValueAtTime(value, time);
        }
        envelope.gain.linearRampToValueAtTime(0, time + 0.008);
        oscillator.stop(time + 0.008);
      } catch { /* A browser may have already ended the source. */ }
    },
    disconnect() {
      if (disconnected) return; disconnected = true;
      oscillator.onended = null; oscillator.disconnect(); envelope.disconnect();
    },
  };
  try {
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(high, now);
    oscillator.frequency.exponentialRampToValueAtTime(low, now + duration);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.linearRampToValueAtTime(peak, now + 0.003);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(envelope); envelope.connect(output);
    oscillator.onended = () => { voice.disconnect(); onEnded(voice); };
    oscillator.start(now); oscillator.stop(now + duration);
  } catch (error) { voice.stop(); voice.disconnect(); throw error; }
  return voice;
}

export function playPlayerHit(context: AudioContext, output: AudioNode, onEnded: (voice: Voice) => void = () => {}): Voice {
  return tone(context, output, 'triangle', 1150, 700, 0.055, 0.16, onEnded);
}
export function playOpponentHit(context: AudioContext, output: AudioNode, onEnded: (voice: Voice) => void = () => {}): Voice {
  return tone(context, output, 'sine', 440, 220, 0.085, 0.16, onEnded);
}
export function playSmashWarning(context: AudioContext, output: AudioNode, onEnded: (voice: Voice) => void = () => {}): Voice {
  return tone(context, output, 'triangle', 660, 1320, 0.12, 0.11, onEnded);
}
