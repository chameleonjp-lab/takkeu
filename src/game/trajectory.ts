import type { GameConfig, Point3, ReturnPlan } from './types';
import { DEFAULT_CONFIG, TRAJECTORY } from './config';

export function bounceTime(plan: ReturnPlan): number {
  return plan.departAt + (plan.arriveAt - plan.departAt) * TRAJECTORY.bounceFraction;
}

export function sampleReturn(plan: ReturnPlan, from: Point3, time: number): Point3 {
  const u = Math.max(0, (time - plan.departAt) / (plan.arriveAt - plan.departAt));
  const bounceY = plan.bounceY ?? DEFAULT_CONFIG.ballRadius;
  const endZ = plan.landingZ ?? (from.z < 0 ? DEFAULT_CONFIG.paddleZ : -DEFAULT_CONFIG.paddleZ);
  let y: number;
  if (u <= TRAJECTORY.bounceFraction) {
    const v = u / TRAJECTORY.bounceFraction;
    y = from.y + (bounceY - from.y) * v + TRAJECTORY.flightArcHeight * 4 * v * (1 - v);
  } else {
    const v = (u - TRAJECTORY.bounceFraction) / (1 - TRAJECTORY.bounceFraction);
    y = bounceY + (plan.target.y - bounceY) * v + TRAJECTORY.bounceArcHeight * 4 * v * (1 - v);
  }
  const x = plan.bounceX === undefined ? from.x + (plan.target.x - from.x) * u
    : u <= TRAJECTORY.bounceFraction ? from.x + (plan.bounceX - from.x) * u / TRAJECTORY.bounceFraction
    : plan.bounceX + (plan.target.x - plan.bounceX) * (u - TRAJECTORY.bounceFraction) / (1 - TRAJECTORY.bounceFraction);
  return { x, y, z: from.z + (endZ - from.z) * u };
}

/** A continuous kink at the table, with the landing point safely inside it. */
export function deflectBounce(plan: ReturnPlan, from: Point3, randomValue: number, config: GameConfig): ReturnPlan {
  // Put the turn outside both endpoints on the target's side. Overshooting
  // toward the centre made every left-wing return catchable at the centre.
  const direction = plan.target.x >= 0 ? 1 : -1;
  const outside = direction > 0 ? Math.max(from.x, plan.target.x) : Math.min(from.x, plan.target.x);
  const edge = config.tableHalfWidth - config.ballRadius * 1.5;
  const bounceX = Math.max(-edge, Math.min(edge, outside + direction * (0.18 + randomValue * 0.22)));
  return { ...plan, bounceX };
}
