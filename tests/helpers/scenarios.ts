import { DEFAULT_CONFIG, INITIAL_PADDLE } from '../../src/game/config';
import { MILESTONES } from '../../src/game/milestones';
import { createSimulationState, snapshotSimulation, startSimulation, stepSimulation } from '../../src/game/simulation';
import { sampleReturn } from '../../src/game/trajectory';
import type { ReturnPlan } from '../../src/game/types';

/** Test-owned state construction; no score setter, automation or fixture route in the app. */
export function scenario(score: number, time = 20) {
  const state = createSimulationState(7);
  startSimulation(state, DEFAULT_CONFIG);
  state.score = score;
  state.simTime = time;
  state.progression = { appliedMilestones: MILESTONES.filter(n => n <= score), ballGlowUntil: null };
  state.balls = [];
  const snapshot = () => snapshotSimulation(state);
  const step = (target = INITIAL_PADDLE) => stepSimulation(state, DEFAULT_CONFIG, DEFAULT_CONFIG.fixedDt, { target });
  return { state, snapshot, step };
}

export function incoming(id: number, arriveAt: number, target = INITIAL_PADDLE, now = 20, duration = 1.2) {
  const plan: ReturnPlan = { ballId: id, departAt: arriveAt - duration, netCrossAt: arriveAt - duration / 2, arriveAt, target, smash: false, warningAt: null, speedMultiplier: 2.2, landingZ: DEFAULT_CONFIG.paddleZ };
  const from = { x: target.x, y: 0.5, z: -DEFAULT_CONFIG.paddleZ };
  return { id, phase: 'incoming' as const, position: sampleReturn(plan, from, now), from, plan, warningSent: false };
}
