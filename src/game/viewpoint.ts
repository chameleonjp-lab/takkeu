import type { GameConfig, Point3 } from './types';

// Shared by rendering and gameplay. Resizing changes only the frame, not contact.
export const VIEWPOINT = { eye: { x: 0.34, y: 1.3, z: 3.4 }, target: { x: 0.34, y: 0, z: 0 } } as const;
export const REFERENCE_ASPECT = 225 / 157;

const eyeDistance = Math.hypot(VIEWPOINT.eye.y - VIEWPOINT.target.y, VIEWPOINT.eye.z - VIEWPOINT.target.z);
const sin = (VIEWPOINT.eye.y - VIEWPOINT.target.y) / eyeDistance;
const cos = (VIEWPOINT.eye.z - VIEWPOINT.target.z) / eyeDistance;
function viewSlope(point: Point3) {
  const dy = point.y - VIEWPOINT.eye.y, dz = point.z - VIEWPOINT.eye.z;
  const depth = -dy * sin - dz * cos;
  return { x: (point.x - VIEWPOINT.eye.x) / depth, y: (dy * cos - dz * sin) / depth };
}

/** Off-axis perspective frame, shared with the paddle's reachable region. */
export function viewFrame(config: GameConfig, aspect: number) {
  const table = [-config.tableHalfWidth, config.tableHalfWidth].flatMap(x =>
    [-config.tableHalfLength, config.tableHalfLength].map(z => viewSlope({ x, y: config.tableY, z })));
  const play = [
    viewSlope({ x: 0, y: config.paddleMinY - config.paddleRadius - 0.26, z: config.paddleZ }),
    viewSlope({ x: 0, y: 0.86, z: -config.paddleZ }),
  ];
  const bottom = Math.min(...table.map(p => p.y), ...play.map(p => p.y));
  const top = Math.max(...table.map(p => p.y), ...play.map(p => p.y));
  const left = Math.min(...table.map(p => p.x)), right = Math.max(...table.map(p => p.x));
  const halfWidth = Math.max((right - left) / 2, (top - bottom) / 2 * aspect) * 1.035;
  const halfHeight = halfWidth / aspect;
  const centerX = (left + right) / 2 + halfWidth * 0.025;
  const centerY = (top + bottom) / 2 - (top - bottom) * 0.04;
  return { left: centerX - halfWidth, right: centerX + halfWidth, top: centerY + halfHeight, bottom: centerY - halfHeight };
}

/** Keep the face and leaning handle visible, with identical bounds on rotation. */
const referenceFrames = new WeakMap<GameConfig, ReturnType<typeof viewFrame>>();
export function paddleHorizontalRange(y: number, config: GameConfig): { min: number; max: number } {
  let frame = referenceFrames.get(config);
  if (!frame) { frame = viewFrame(config, REFERENCE_ASPECT); referenceFrames.set(config, frame); }
  const depth = (VIEWPOINT.eye.y - y) * sin + (VIEWPOINT.eye.z - config.paddleZ) * cos;
  const margin = config.paddleRadius + 0.10;
  return { min: Math.max(config.paddleMinX, VIEWPOINT.eye.x + frame.left * depth + margin),
    max: Math.min(config.paddleMaxX, VIEWPOINT.eye.x + frame.right * depth - margin) };
}

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
