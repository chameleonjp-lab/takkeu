import type { GameConfig, GameEvent, GameSession, PauseReason, StepResult } from '../game/types';
import type { InputTimeline } from '../input/timeline';
export type LoopOptions = { config: GameConfig; session: GameSession; timeline: InputTimeline; onEvents(events: readonly GameEvent[]): void; onPause(reason: PauseReason): void };
export function createLoop(options: LoopOptions) {
  let lastSimulation: number | null = null;
  let lastFrame: number | null = null;
  let accumulator = 0;
  let pendingEvents: GameEvent[] = [];
  const { session, config, timeline } = options;
  const pauseForDelay = (now: number): boolean => {
    if (session.snapshot().phase !== 'running' || lastFrame === null || (now - lastFrame) / 1000 <= config.slowFrameSeconds + 1e-10) return false;
    accumulator = 0; pendingEvents = []; lastSimulation = now;
    session.pause('slow-frame'); timeline.clear(session.snapshot().paddle);
    options.onPause('slow-frame');
    return true;
  };
  const advance = (now: number): void => {
    now = Math.max(lastSimulation ?? now, now);
    const elapsed = lastSimulation === null ? 0 : Math.max(0, now - lastSimulation) / 1000;
    lastSimulation = now;
    if (session.snapshot().phase !== 'running') { accumulator = 0; return; }
    accumulator += elapsed;
    let steps = 0;
    while (accumulator + 1e-10 >= config.fixedDt && steps < config.maxStepsPerFrame) {
      const time = session.snapshot().simTime;
      const result = session.step(config.fixedDt, timeline.sampleAt(time));
      pendingEvents.push(...result.events);
      options.onEvents(result.events);
      accumulator = Math.max(0, accumulator - config.fixedDt);
      steps++;
      if (result.snapshot.phase !== 'running') { accumulator = 0; break; }
    }
  };
  return {
    resetClock(now: number) { lastSimulation = now; lastFrame = now; accumulator = 0; pendingEvents = []; },
    toSimTime(timestamp: number) {
      const state = session.snapshot();
      if (state.phase !== 'running' || lastSimulation === null) return state.simTime;
      return state.simTime + accumulator + Math.max(0, timestamp - lastSimulation) / 1000;
    },
    // Flush chronological input before reading a release/recontact origin.
    // This does not render, reset the draw-delay clock, or consume draw events.
    flushInput(now: number) { if (!pauseForDelay(now)) advance(now); },
    frame(now: number): StepResult {
      if (pauseForDelay(now)) {
        lastFrame = now;
        return { snapshot: session.snapshot(), events: [] };
      }
      lastFrame = now;
      advance(now);
      const events = pendingEvents;
      pendingEvents = [];
      return { snapshot: session.snapshot(), events };
    },
  };
}
