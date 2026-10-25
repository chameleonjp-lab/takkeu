import { clampPaddle, DIFFICULTY } from './config';
import { flightDuration, smashMultiplier } from './difficulty';
import type { GameConfig, PaddlePoint, ReturnPlan } from './types';

export type ReturnRequest = Readonly<{
  ballId: number; earliestDepartAt: number; preferredTarget: PaddlePoint;
  speedMultiplier: number; smash: boolean; earliestArriveAt?: number;
  score?: number; remainingBallMultiplier?: number;
}>;

/** Each ball returns when ready; other balls cannot hold it in a global queue. */
export function scheduleReturn(request: ReturnRequest, _reserved: readonly ReturnPlan[], config: GameConfig): ReturnPlan {
  const target = clampPaddle(request.preferredTarget, config);
  const score = request.score ?? 0;
  const duration = flightDuration(config, score, request.smash, request.speedMultiplier, request.remainingBallMultiplier);
  const visible = duration / 2;
  const arriveAt = Math.max(request.earliestDepartAt + (request.smash ? DIFFICULTY.smashWarning : 0) + duration, request.earliestArriveAt ?? 0);
  const departAt = arriveAt - duration;
  return {
    ballId: request.ballId, departAt, netCrossAt: departAt + visible, arriveAt, target,
    smash: request.smash, warningAt: request.smash ? departAt - DIFFICULTY.smashWarning : null,
    speedMultiplier: request.speedMultiplier, landingZ: config.paddleZ, bounceY: config.tableY + config.ballRadius,
    speedScore: score, remainingBallMultiplier: request.remainingBallMultiplier ?? 1,
    ...(request.smash ? { smashMultiplier: smashMultiplier(score) } : {}),
  };
}
