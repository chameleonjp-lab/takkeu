import type { GameConfig, Point3 } from './types';

// Shared by rendering and gameplay. Resizing changes only the frame, not contact.
export const VIEWPOINT = { eye: { x: 0, y: 2.8, z: 4.5 }, target: { x: 0, y: 0.1, z: 0.1 } } as const;

/** Project the visible ball onto the plane in which the player moves the paddle. */
export function projectBall(point: Point3, config: GameConfig): Point3 & { radius: number } {
  const eye = VIEWPOINT.eye;
  const depth = Math.max(config.ballRadius * 2, eye.z - point.z);
  const scale = (eye.z - config.paddleZ) / depth;
  // A sphere projects to an ellipse on this plane. Its circumscribed radius
  // retains visible edge contacts; decorative glow is never part of contact.
  const r = config.ballRadius;
  const denominator = depth * depth - r * r;
  const lateral = Math.hypot(point.x - eye.x, point.y - eye.y);
  const centerOffset = (eye.z - config.paddleZ) * r * r * lateral / (depth * denominator);
  return {
    x: eye.x + (point.x - eye.x) * scale,
    y: eye.y + (point.y - eye.y) * scale,
    z: config.paddleZ,
    radius: (eye.z - config.paddleZ) * r * Math.sqrt(depth * depth + lateral * lateral - r * r) / denominator + centerOffset,
  };
}
