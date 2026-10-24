import { DEFAULT_CONFIG } from '../../src/game/config';
import { speedMultiplier } from '../../src/game/difficulty';
import { scheduleReturn } from '../../src/game/scheduler';
import { stepSimulation } from '../../src/game/simulation';
import type { SimulationBall } from '../../src/game/simulation';
import type { GameConfig } from '../../src/game/types';
import { scenario } from './scenarios';

export const missPaddle = { x: -0.8, y: 0.2 };
export function waitingBall(id: number, score: number, departAt = 20, config: GameConfig = DEFAULT_CONFIG): SimulationBall {
  const from = { x: 0.5, y: 0.6, z: -1.95 };
  const plan = scheduleReturn({ ballId: id, score, speedMultiplier: speedMultiplier(score), smash: score >= 450,
    earliestDepartAt: departAt - (score >= 450 ? 0.4 : 0), preferredTarget: { x: 0.5, y: 0.6 } }, [], config);
  return { id, phase: 'waiting-return', from, position: from, plan, warningSent: score >= 450,
    ...(score >= 450 ? { warningEmittedAt: departAt - 0.4 } : {}) };
}
export function remainingScenario(score: number, count: number, departAt = 20, config: GameConfig = DEFAULT_CONFIG) {
  const s = scenario(score);
  // The other balls are alive, hidden and scheduled far in the future.
  s.state.balls = Array.from({ length: count }, (_, i) => ({ ...waitingBall(i + 1, score, i ? 1000 + i : departAt, config),
    phase: i % 2 ? 'queued' : 'waiting-return' }));
  return s;
}

/** Observe actual simulated z crossings, independently of planned arrival times. */
export function measureFlight(score: number, count: number, config: GameConfig = DEFAULT_CONFIG) {
  const s = remainingScenario(score, count, 20, config);
  let departed: number | undefined, net: number | undefined, arrived: number | undefined;
  let previous = { time: s.state.simTime, z: -1.95 };
  for (let tick = 0; tick < 500 && arrived === undefined; tick++) {
    const result = stepSimulation(s.state, config, config.fixedDt, { target: missPaddle });
    departed ??= result.events.find(e => e.kind === 'opponent-hit' && e.ballId === 1)?.time;
    const ball = s.state.balls.find(b => b.id === 1);
    if (!ball) throw new Error('Ball lost before crossing the paddle plane');
    const current = { time: s.state.simTime, z: ball.position.z };
    const crossing = (z: number) => previous.time + (current.time - previous.time) * (z - previous.z) / (current.z - previous.z);
    if (previous.z < 0 && current.z >= 0) net = crossing(0);
    if (previous.z < 1.95 && current.z >= 1.95) arrived = crossing(1.95);
    previous = current;
  }
  if (departed === undefined || net === undefined || arrived === undefined) throw new Error('Flight did not finish');
  return { score, count, departed, net, arrived, duration: arrived - departed, visible: arrived - net };
}
