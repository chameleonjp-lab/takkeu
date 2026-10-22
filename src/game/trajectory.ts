import type { Point3, ReturnPlan } from './types';
import { DEFAULT_CONFIG, TRAJECTORY } from './config';

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
  return { x: from.x + (plan.target.x - from.x) * u, y, z: from.z + (endZ - from.z) * u };
}
