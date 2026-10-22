import { projectBall, VIEWPOINT } from './viewpoint';
import type { GameConfig, PaddlePoint, Point3 } from './types';

/** Swept visible ball against the moving paddle, in game units on its plane. */
export function sweepPaddleHit(ballFrom: Point3, ballTo: Point3, paddleFrom: PaddlePoint, paddleTo: PaddlePoint, config: GameConfig): number | null {
  const from = projectBall(ballFrom, config), to = projectBall(ballTo, config);
  const rx = from.x - paddleFrom.x, ry = from.y - paddleFrom.y;
  const vx = to.x - from.x - (paddleTo.x - paddleFrom.x);
  const vy = to.y - from.y - (paddleTo.y - paddleFrom.y);
  const radius = config.paddleRadius + from.radius, dr = to.radius - from.radius;
  // Sweep the projected endpoints of one fixed step, including the perspective
  // change in ball size. This also catches fast crossings between two frames.
  const a = vx * vx + vy * vy - dr * dr;
  const b = 2 * (rx * vx + ry * vy - radius * dr);
  const c = rx * rx + ry * ry - radius * radius;
  if (c <= 1e-12) return 0;
  if (Math.abs(a) < 1e-12) {
    const t = -c / b;
    return b < 0 && t >= 0 && t <= 1 ? t : null;
  }
  const discriminant = b * b - 4 * a * c;
  if (discriminant < -1e-12) return null;
  const root = Math.sqrt(Math.max(0, discriminant));
  const candidates = [(-b - root) / (2 * a), (-b + root) / (2 * a)].sort((x, y) => x - y);
  return candidates.find(t => t >= 0 && t <= 1) ?? null;
}

/** A miss occurs only once the entire visible ball has passed below reach. */
export function paddleExitFraction(from: Point3, to: Point3, config: GameConfig): number | null {
  const passed = (point: Point3): boolean => {
    if (point.z <= config.paddleZ) return false;
    if (point.z >= VIEWPOINT.eye.z - config.ballRadius * 2) return true;
    const projected = projectBall(point, config);
    return projected.y + projected.radius < config.paddleMinY - config.paddleRadius;
  };
  if (!passed(to)) return null;
  if (passed(from)) return 0;
  let lower = 0, upper = 1;
  for (let i = 0; i < 32; i++) {
    const t = (lower + upper) / 2;
    const point = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, z: from.z + (to.z - from.z) * t };
    if (passed(point)) upper = t; else lower = t;
  }
  return upper;
}
