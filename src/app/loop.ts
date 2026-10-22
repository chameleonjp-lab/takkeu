import type { GameConfig, GameEvent, GameSession, PauseReason, StepResult } from '../game/types';
import type { InputTimeline } from '../input/timeline';
export type LoopOptions = { config: GameConfig; session: GameSession; timeline: InputTimeline; onEvents(events: readonly GameEvent[]): void; onPause(reason: PauseReason): void };
export function createLoop(options: LoopOptions) {
  let last: number | null = null;
  let accumulator = 0;
  const { session, config, timeline } = options;
  return {
    resetClock(now: number) { last = now; accumulator = 0; },
    toSimTime(timestamp: number) {
      const state = session.snapshot();
      if (state.phase !== 'running' || last === null) return state.simTime;
      return state.simTime + accumulator + Math.max(0, timestamp - last) / 1000;
    },
    frame(now: number): StepResult {
      const state = session.snapshot();
      const elapsed = last === null ? 0 : Math.max(0, now - last) / 1000;
      last = now;
      if (state.phase !== 'running') { accumulator = 0; return { snapshot: state, events: [] }; }
      if (elapsed > config.slowFrameSeconds + 1e-10) {
        accumulator = 0;
        session.pause('slow-frame');
        timeline.clear(state.paddle);
        options.onPause('slow-frame');
        return { snapshot: session.snapshot(), events: [] };
      }
      accumulator += elapsed;
      const events: GameEvent[] = [];
      let steps = 0;
      while (accumulator + 1e-10 >= config.fixedDt && steps < config.maxStepsPerFrame) {
        const time = session.snapshot().simTime;
        const result = session.step(config.fixedDt, timeline.sampleAt(time));
        events.push(...result.events);
        options.onEvents(result.events);
        accumulator = Math.max(0, accumulator - config.fixedDt);
        steps++;
        if (result.snapshot.phase !== 'running') { accumulator = 0; break; }
      }
      return { snapshot: session.snapshot(), events };
    },
  };
}
