import type { GameConfig, PaddlePoint, Point3 } from './types';

/** Swept sphere against a translating circular disc; returns the first contact. */
export function sweepPaddleHit(ballFrom: Point3, ballTo: Point3, paddleFrom: PaddlePoint, paddleTo: PaddlePoint, config: GameConfig): number | null {
  const dz = ballTo.z - ballFrom.z;
  let lower = 0;
  let upper = 1;
  // Only the portion within one ball radius of the paddle plane can collide.
  if (Math.abs(dz) < 1e-15) {
    if (Math.abs(ballFrom.z - config.paddleZ) > config.ballRadius) return null;
  } else {
    const a = (config.paddleZ - config.ballRadius - ballFrom.z) / dz;
    const b = (config.paddleZ + config.ballRadius - ballFrom.z) / dz;
    lower = Math.max(0, Math.min(a, b));
    upper = Math.min(1, Math.max(a, b));
    if (lower > upper) return null;
  }
  const rx = ballFrom.x - paddleFrom.x;
  const ry = ballFrom.y - paddleFrom.y;
  const vx = ballTo.x - ballFrom.x - (paddleTo.x - paddleFrom.x);
  const vy = ballTo.y - ballFrom.y - (paddleTo.y - paddleFrom.y);
  const distanceSquared = (t: number): number => {
    const radial = Math.max(0, Math.hypot(rx + vx * t, ry + vy * t) - config.paddleRadius);
    return radial * radial + (ballFrom.z + dz * t - config.paddleZ) ** 2;
  };
  const threshold = config.ballRadius ** 2 + 1e-14;
  if (distanceSquared(lower) <= threshold) return lower;
  // Distance to a convex disc along a line is convex. Find its minimum, then
  // bisect the leading root. This also detects a tangential edge contact.
  let left = lower;
  let right = upper;
  for (let i = 0; i < 56; i++) {
    const a = left + (right - left) / 3;
    const b = right - (right - left) / 3;
    if (distanceSquared(a) < distanceSquared(b)) right = b;
    else left = a;
  }
  const minimum = (left + right) / 2;
  if (distanceSquared(minimum) > threshold) return null;
  left = lower;
  right = minimum;
  for (let i = 0; i < 48; i++) {
    const mid = (left + right) / 2;
    if (distanceSquared(mid) <= threshold) right = mid;
    else left = mid;
  }
  return right;
}
