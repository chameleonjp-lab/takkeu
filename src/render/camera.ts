import { PerspectiveCamera } from 'three';
import type { GameConfig } from '../game/types';
import { viewFrame, VIEWPOINT } from '../game/viewpoint';

export function createCamera(): PerspectiveCamera {
  const camera = new PerspectiveCamera(50, 1, 0.1, 30);
  const { eye, target } = VIEWPOINT;
  camera.position.set(eye.x, eye.y, eye.z);
  camera.lookAt(target.x, target.y, target.z); camera.updateMatrixWorld();
  return camera;
}

/** Frame the table from the reference's low viewpoint. Rotation only reframes. */
export function fitCamera(camera: PerspectiveCamera, width: number, height: number, config: GameConfig): void {
  const aspect = Math.max(1, width) / Math.max(1, height);
  const frame = viewFrame(config, aspect), near = camera.near;
  camera.aspect = aspect;
  camera.fov = 2 * Math.atan((frame.top - frame.bottom) / 2) * 180 / Math.PI;
  camera.projectionMatrix.makePerspective(frame.left * near, frame.right * near, frame.top * near, frame.bottom * near, near, camera.far);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}
