import { DEFAULT_CONFIG } from '../../src/game/config';
import { createSession } from '../../src/game/session';
import type { GameEvent, InputSample } from '../../src/game/types';

export function replay(renderHz: number, samples: readonly InputSample[], seconds = 12) {
  const session = createSession(DEFAULT_CONFIG, 7);
  session.start();
  let ticks = 0;
  let sampleIndex = 0;
  let target = { x: 0, y: 0.5 };
  const events: GameEvent[] = [];
  for (let frame = 1; frame <= seconds * renderHz; frame++) {
    const until = frame / renderHz;
    while ((ticks + 1) * DEFAULT_CONFIG.fixedDt <= until + 1e-10) {
      const time = ticks * DEFAULT_CONFIG.fixedDt;
      while (samples[sampleIndex] && samples[sampleIndex]!.at <= time + 1e-10) {
        target = samples[sampleIndex++]!.target;
      }
      events.push(...session.step(DEFAULT_CONFIG.fixedDt, { target }).events);
      ticks++;
    }
  }
  const snapshot = session.snapshot();
  return { score: snapshot.score, phase: snapshot.phase, simTime: snapshot.simTime, balls: snapshot.balls, progression: snapshot.progression, events: events.map(({ kind, time }) => ({ kind, time })) };
}
