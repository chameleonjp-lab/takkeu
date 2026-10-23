import { Plane, Raycaster, Vector2, Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
import { clampPaddle } from '../game/config';
import type { GameConfig, PaddlePoint } from '../game/types';

export type InputScreen = Readonly<{ left: number; top: number; width: number; height: number }>;
export type InputMapping = Readonly<{
  screen: InputScreen;
  toWorld(clientX: number, clientY: number): PaddlePoint | null;
  isCurrent?(): boolean;
}>;

/** CSS pixels and the rendered camera share one ray; drawing-buffer DPR is irrelevant. */
export function createInputMapping(camera: PerspectiveCamera, readScreen: () => InputScreen, config: GameConfig): InputMapping {
  const { left, top, width, height } = readScreen();
  const screen = { left, top, width, height };
  camera.updateWorldMatrix(true, false);
  const world = camera.matrixWorld.clone();
  const projection = camera.projectionMatrix.clone();
  const inverseProjection = camera.projectionMatrixInverse.clone();
  const raycaster = new Raycaster(), ndc = new Vector2(), intersection = new Vector3();
  const paddlePlane = new Plane(new Vector3(0, 0, 1), -config.paddleZ);
  const validScreen = [left, top, width, height].every(Number.isFinite) && width > 0 && height > 0;
  const isCurrent = (): boolean => {
    const current = readScreen();
    camera.updateWorldMatrix(true, false);
    return validScreen && current.left === left && current.top === top && current.width === width && current.height === height
      && camera.matrixWorld.equals(world) && camera.projectionMatrix.equals(projection) && camera.projectionMatrixInverse.equals(inverseProjection);
  };
  return {
    screen, isCurrent,
    toWorld(clientX, clientY) {
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY) || !isCurrent()) return null;
      ndc.set((clientX - left) / width * 2 - 1, 1 - (clientY - top) / height * 2);
      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.ray.intersectPlane(paddlePlane, intersection) || !Number.isFinite(intersection.x) || !Number.isFinite(intersection.y)) return null;
      return clampPaddle(intersection, config);
    },
  };
}
