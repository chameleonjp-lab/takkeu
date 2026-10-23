import { DIFFICULTY } from './config';
import { flightDuration, speedMultiplier } from './difficulty';
import { scheduleReturn } from './scheduler';
import { deflectBounce } from './trajectory';
import { randomUnit } from './targets';
import type { SimulationState } from './simulation';
import type { GameConfig, ReturnPlan } from './types';

/** Keep the same normalized trajectory point when the entire rally accelerates. */
export function retimeFlight(plan: ReturnPlan, time: number, oldScore: number, score: number, config: GameConfig): ReturnPlan {
  const ratio = flightDuration(config, oldScore, plan.smash) / flightDuration(config, score, plan.smash);
  return { ...plan, departAt: time + (plan.departAt - time) / ratio,
    netCrossAt: time + (plan.netCrossAt - time) / ratio, arriveAt: time + (plan.arriveAt - time) / ratio,
    speedMultiplier: speedMultiplier(score), speedScore: score,
    ...(plan.smash ? { smashMultiplier: score >= 540 ? DIFFICULTY.lateSmashSpeed : DIFFICULTY.smashSpeed } : {}) };
}

export function refreshFlightSpeeds(state: SimulationState, oldScore: number, time: number, config: GameConfig): void {
  if (state.score === oldScore) return;
  for (const ball of state.balls) if (ball.phase === 'incoming' || ball.phase === 'outgoing') {
    const applied = ball.plan.speedScore ?? oldScore;
    if (applied !== state.score) ball.plan = retimeFlight(ball.plan, time, applied, state.score, config);
  }
  const reserved = state.balls.filter(b => b.phase === 'incoming').map(b => b.plan);
  const queued = state.balls.filter(b => b.phase === 'queued' || b.phase === 'waiting-return')
    .sort((a, b) => a.plan.arriveAt - b.plan.arriveAt || a.id - b.id);
  for (const ball of queued) {
    const bounceX = ball.plan.bounceX;
    const smash = state.score >= 450;
    if (smash !== ball.plan.smash) { ball.warningSent = false; delete ball.warningEmittedAt; }
    const earliest = Math.max(ball.plan.departAt, time + (smash && !ball.warningSent ? DIFFICULTY.smashWarning : 0),
      ball.warningEmittedAt === undefined ? time : ball.warningEmittedAt + DIFFICULTY.smashWarning);
    ball.plan = scheduleReturn({ ballId: ball.id, earliestDepartAt: earliest - (smash ? DIFFICULTY.smashWarning : 0),
      preferredTarget: ball.plan.target, speedMultiplier: speedMultiplier(state.score), score: state.score, smash }, reserved, config);
    if(ball.warningSent&&ball.warningEmittedAt!==undefined)ball.plan={...ball.plan,warningAt:ball.warningEmittedAt};
    if (bounceX !== undefined) ball.plan = { ...ball.plan, bounceX };
    else if (state.score >= 555) ball.plan = deflectBounce(ball.plan, ball.from, randomUnit(state), config);
    reserved.push(ball.plan);
  }
}
