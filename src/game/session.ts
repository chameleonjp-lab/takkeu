import { createSimulationState, snapshotSimulation, startSimulation, stepSimulation } from './simulation';
import type { GameConfig, GameSession } from './types';

export function createSession(config: GameConfig, seed: number): GameSession {
  let state = createSimulationState(seed);
  return {
    snapshot: () => snapshotSimulation(state),
    start: () => startSimulation(state, config),
    step: (dt, input) => stepSimulation(state, config, dt, input),
    pause(reason) { if (state.phase === 'running') { state.phase = 'paused'; state.pauseReason = reason; } },
    resume() { if (state.phase === 'paused') { state.phase = 'running'; state.pauseReason = null; } },
    reset(nextSeed) { state = createSimulationState(nextSeed); },
  };
}
