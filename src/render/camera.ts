import { PerspectiveCamera, Vector3 } from 'three';
import type { GameConfig } from '../game/types';
import { VIEWPOINT } from '../game/viewpoint';

export function createCamera(): PerspectiveCamera {
  const camera = new PerspectiveCamera(50, 1, 0.1, 30);
  const { eye, target } = VIEWPOINT;
  camera.position.set(eye.x, eye.y, eye.z);
  camera.lookAt(target.x, target.y, target.z); camera.updateMatrixWorld();
  return camera;
}

/** Fit the entire table and paddle travel without changing the fixed eye. */
export function fitCamera(camera: PerspectiveCamera, width: number, height: number, config: GameConfig): void {
  const points: number[][] = [];
  for (const x of [-config.tableHalfWidth, config.tableHalfWidth]) {
    for (const z of [-config.tableHalfLength, config.tableHalfLength]) points.push([x, config.tableY, z]);
  }
  for (const x of [config.paddleMinX - config.paddleRadius, config.paddleMaxX + config.paddleRadius]) {
    for (const y of [config.paddleMinY - config.paddleRadius - 0.18, config.paddleMaxY + config.paddleRadius]) points.push([x, y, config.paddleZ]);
  }
  points.push([0, 1.25, -config.paddleZ - 0.4]);
  const slopes = points.map(point => {
    const p = new Vector3(...point as [number, number, number]).applyMatrix4(camera.matrixWorldInverse);
    return { x: p.x / -p.z, y: p.y / -p.z };
  });
  const bottom = Math.min(...slopes.map(p => p.y)), top = Math.max(...slopes.map(p => p.y));
  const aspect = Math.max(1, width) / Math.max(1, height);
  const halfWidth = Math.max(...slopes.map(p => Math.abs(p.x)), (top - bottom) / 2 * aspect) * 1.08;
  const halfHeight = halfWidth / aspect, center = (top + bottom) / 2, near = camera.near;
  camera.aspect = aspect;
  camera.fov = 2 * Math.atan(halfHeight) * 180 / Math.PI;
  camera.projectionMatrix.makePerspective(-halfWidth * near, halfWidth * near, (center + halfHeight) * near, (center - halfHeight) * near, near, camera.far);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}
