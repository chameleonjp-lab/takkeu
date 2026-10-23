import { clampPaddle, DIFFICULTY } from './config';
import { flightDuration, smashMultiplier } from './difficulty';
import type { GameConfig, PaddlePoint, ReturnPlan } from './types';

export type ReturnRequest = Readonly<{
  ballId: number; earliestDepartAt: number; preferredTarget: PaddlePoint;
  speedMultiplier: number; smash: boolean; earliestArriveAt?: number;
  score?: number;
}>;

/** Insert a fixed target into both neighbouring gaps; only this new flight can move. */
export function scheduleReturn(request: ReturnRequest, reserved: readonly ReturnPlan[], config: GameConfig): ReturnPlan {
  const target = clampPaddle(request.preferredTarget, config);
  const score = request.score ?? 0;
  const duration = flightDuration(config, score, request.smash, request.speedMultiplier);
  const visible = duration / 2;
  let arriveAt = Math.max(request.earliestDepartAt + (request.smash ? DIFFICULTY.smashWarning : 0) + duration, request.earliestArriveAt ?? 0);
  for (const next of [...reserved].sort((a, b) => a.arriveAt - b.arriveAt || a.ballId - b.ballId)) {
    const current = { ...request, target, speedScore: score, arriveAt: arriveAt, departAt: arriveAt - duration };
    const gap = reservationGap(current, next, config);
    if (arriveAt <= next.arriveAt - gap + 1e-12) break;
    if (arriveAt < next.arriveAt + gap) arriveAt = next.arriveAt + gap;
  }
  const departAt = arriveAt - duration;
  return {
    ballId: request.ballId, departAt, netCrossAt: departAt + visible, arriveAt, target,
    smash: request.smash, warningAt: request.smash ? departAt - DIFFICULTY.smashWarning : null,
    speedMultiplier: request.speedMultiplier, landingZ: config.paddleZ, bounceY: config.tableY + config.ballRadius,
    speedScore: score, ...(request.smash ? { smashMultiplier: smashMultiplier(score) } : {}),
  };
}

type GapFlight = Pick<ReturnPlan, 'target' | 'smash' | 'speedMultiplier' | 'arriveAt' | 'departAt'> & { speedScore?: number };
/** Reserve space for subsequent global acceleration, including the 540 tier. */
export function reservationGap(a: GapFlight, b: GapFlight, config: GameConfig): number {
  const grow = (p: GapFlight) => flightDuration(config, p.speedScore ?? 0, p.smash, p.speedMultiplier) / flightDuration(config, Infinity, p.smash);
  const growth = Math.max(1, grow(a), grow(b));
  const base = DIFFICULTY.arrivalGap + Math.hypot(a.target.x - b.target.x, a.target.y - b.target.y) / config.paddleSpeed;
  // A late smash can close on an older normal flight. Reserve that additional
  // closure too; rescheduling a queue cannot repair two balls already flying.
  const closing = a.smash !== b.smash
    ? Math.max(a.arriveAt - a.departAt, b.arriveAt - b.departAt) * (DIFFICULTY.lateSmashSpeed / DIFFICULTY.smashSpeed - 1) * growth : 0;
  return base * growth + closing;
}
