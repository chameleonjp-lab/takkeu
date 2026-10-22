import { OrthographicCamera, Vector3 } from 'three';
import type { GameConfig } from '../game/types';

export function createCamera(): OrthographicCamera {
  const camera = new OrthographicCamera(-1.5, 1.5, 1, -1, 0.1, 30);
  camera.position.set(0, 3.6, 6.8); camera.lookAt(0, 0.1, 0.7); camera.updateMatrixWorld();
  return camera;
}
/** Keep the fixed viewpoint; expand its frame to include the newly unlocked actor. */
export function fitCamera(camera: OrthographicCamera, width: number, height: number, config: GameConfig): void {
  const bottom = new Vector3(0, config.paddleMinY - config.paddleRadius - 0.18, config.paddleZ).applyMatrix4(camera.matrixWorldInverse).y - 0.1;
  const top = new Vector3(0, 1.25, -config.paddleZ - 0.4).applyMatrix4(camera.matrixWorldInverse).y + 0.1;
  const aspect = Math.max(1, width) / Math.max(1, height);
  const viewWidth = Math.max(2.8, (top - bottom) * aspect);
  const center = (top + bottom) / 2, halfHeight = viewWidth / aspect / 2;
  camera.left = -viewWidth / 2; camera.right = viewWidth / 2;
  camera.top = center + halfHeight; camera.bottom = center - halfHeight;
  camera.updateProjectionMatrix();
}
