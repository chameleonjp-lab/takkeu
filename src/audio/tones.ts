export type Voice = { stop(): void; disconnect(): void };

function tone(context: AudioContext, output: AudioNode, type: OscillatorType, high: number, low: number, duration: number, onEnded: (voice: Voice) => void): Voice {
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  const now = context.currentTime;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(high, now);
  oscillator.frequency.exponentialRampToValueAtTime(low, now + duration);
  envelope.gain.setValueAtTime(0.0001, now);
  envelope.gain.linearRampToValueAtTime(0.35, now + 0.003);
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(envelope);
  envelope.connect(output);
  const voice: Voice = {
    stop() {
      try {
        envelope.gain.cancelScheduledValues(context.currentTime);
        envelope.gain.setValueAtTime(0.0001, context.currentTime);
        oscillator.stop(context.currentTime + 0.008);
      } catch { /* The oscillator may already have ended. */ }
    },
    disconnect() { oscillator.disconnect(); envelope.disconnect(); },
  };
  oscillator.onended = () => { voice.disconnect(); onEnded(voice); };
  oscillator.start(now);
  oscillator.stop(now + duration);
  return voice;
}

export function playPlayerHit(context: AudioContext, output: AudioNode, onEnded: (voice: Voice) => void = () => {}): Voice {
  return tone(context, output, 'triangle', 1150, 700, 0.055, onEnded);
}

export function playOpponentHit(context: AudioContext, output: AudioNode, onEnded: (voice: Voice) => void = () => {}): Voice {
  return tone(context, output, 'sine', 440, 220, 0.085, onEnded);
}

export function playSmashWarning(context: AudioContext, output: AudioNode, onEnded: (voice: Voice) => void = () => {}): Voice {
  return tone(context, output, 'triangle', 660, 1320, 0.12, onEnded);
}
