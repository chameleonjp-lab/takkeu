import { clampPaddle, DIFFICULTY } from './config';
import type { GameConfig, PaddlePoint, ReturnPlan } from './types';

export type ReturnRequest = Readonly<{
  ballId: number; earliestDepartAt: number; preferredTarget: PaddlePoint;
  speedMultiplier: number; smash: boolean; earliestArriveAt?: number;
}>;

/** Insert a fixed target into both neighbouring gaps; only this new flight can move. */
export function scheduleReturn(request: ReturnRequest, reserved: readonly ReturnPlan[], config: GameConfig): ReturnPlan {
  const target = clampPaddle(request.preferredTarget, config);
  const visible = request.smash
    ? Math.max(DIFFICULTY.smashMinimumVisible, config.normalVisibleSeconds / (DIFFICULTY.smashSpeed * request.speedMultiplier))
    : Math.max(config.minimumVisibleSeconds, config.normalVisibleSeconds / request.speedMultiplier);
  const duration = visible * 2;
  let arriveAt = Math.max(request.earliestDepartAt + (request.smash ? DIFFICULTY.smashWarning : 0) + duration, request.earliestArriveAt ?? 0);
  for (const next of [...reserved].sort((a, b) => a.arriveAt - b.arriveAt || a.ballId - b.ballId)) {
    const gap = DIFFICULTY.arrivalGap + Math.hypot(target.x - next.target.x, target.y - next.target.y) / config.paddleSpeed;
    if (arriveAt <= next.arriveAt - gap + 1e-12) break;
    if (arriveAt < next.arriveAt + gap) arriveAt = next.arriveAt + gap;
  }
  const departAt = arriveAt - duration;
  return {
    ballId: request.ballId, departAt, netCrossAt: departAt + visible, arriveAt, target,
    smash: request.smash, warningAt: request.smash ? departAt - DIFFICULTY.smashWarning : null,
    speedMultiplier: request.speedMultiplier, landingZ: config.paddleZ, bounceY: config.tableY + config.ballRadius,
  };
}
