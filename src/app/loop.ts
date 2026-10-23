import type { GameConfig, GameEvent, GameSession, PauseReason, StepResult } from '../game/types';
import type { InputTimeline } from '../input/timeline';
export type LoopOptions = { config: GameConfig; session: GameSession; timeline: InputTimeline; onEvents(events: readonly GameEvent[]): void; onPause(reason: PauseReason): void };
export function createLoop(options: LoopOptions) {
  let lastSimulation: number | null = null;
  let lastFrame: number | null = null;
  let accumulator = 0;
  let stepsSinceFrame=0;
  let pendingEvents: GameEvent[] = [];
  const { session, config, timeline } = options;
  const catchUpBudget = () => config.fixedDt * Math.max(0,config.maxStepsPerFrame-stepsSinceFrame);
  const pauseForDelay = (now: number): boolean => {
    if (session.snapshot().phase !== 'running' || lastFrame === null || (now - lastFrame) / 1000 <= config.slowFrameSeconds + 1e-10) return false;
    accumulator = 0; pendingEvents = []; lastSimulation = now;
    session.pause('slow-frame'); timeline.clear(session.snapshot().paddle);
    options.onPause('slow-frame');
    return true;
  };
  const advance = (now: number, preserveInputEndpoint = false): void => {
    now = Math.max(lastSimulation ?? now, now);
    const elapsed = lastSimulation === null ? 0 : Math.max(0, now - lastSimulation) / 1000;
    lastSimulation = now;
    if (session.snapshot().phase !== 'running') { accumulator = 0; return; }
    // A short stall slows this frame instead of storing a debt that later
    // pointer events could consume as a burst of unseen ball movement.
    accumulator = Math.min(catchUpBudget(), accumulator + elapsed);
    while (accumulator + 1e-10 >= config.fixedDt && stepsSinceFrame < config.maxStepsPerFrame) {
      // The pending pointer sample must get a chance to participate at its
      // exact fixed boundary. A normal RAF still commits that boundary.
      if (preserveInputEndpoint && accumulator <= config.fixedDt + 1e-10) break;
      const time = session.snapshot().simTime;
      const result = session.step(config.fixedDt, timeline.take(time, time + config.fixedDt));
      pendingEvents.push(...result.events);
      options.onEvents(result.events);
      accumulator = Math.max(0, accumulator - config.fixedDt);
      stepsSinceFrame++;
      if (result.snapshot.phase !== 'running') { accumulator = 0; break; }
    }
  };
  return {
    resetClock(now: number) { lastSimulation = now; lastFrame = now; accumulator = 0; stepsSinceFrame=0; pendingEvents = []; },
    toSimTime(timestamp: number) {
      const state = session.snapshot();
      if (state.phase !== 'running' || lastSimulation === null) return state.simTime;
      // Preserve the uncommitted remainder's wall-clock origin. Old delivered
      // events (including pre-resume input) must not be retimed into a new tick.
      const pending = accumulator + (timestamp - lastSimulation) / 1000;
      if (!Number.isFinite(pending) || pending < -1e-10) return NaN;
      return state.simTime + Math.min(catchUpBudget(), Math.max(0, pending));
    },
    // Flush chronological input before reading a release/recontact origin.
    // This does not render, reset the draw-delay clock, or consume draw events.
    flushInput(now: number) { if (!pauseForDelay(now)) advance(now, true); },
    frame(now: number): StepResult {
      if (pauseForDelay(now)) {
        lastFrame = now;stepsSinceFrame=0;
        return { snapshot: session.snapshot(), events: [] };
      }
      lastFrame = now;
      advance(now);
      stepsSinceFrame=0;
      const events = pendingEvents;
      pendingEvents = [];
      return { snapshot: session.snapshot(), events };
    },
  };
}
