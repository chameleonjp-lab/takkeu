import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { DEFAULT_CONFIG } from '../../src/game/config';
import { createCamera, fitCamera } from '../../src/render/camera';

it.each([[900, 390], [360, 440], [600, 220]])('全解放後の相手の姿と両コートを%ix%iでも画面に収める', (w, h) => {
  const camera = createCamera(); fitCamera(camera, w, h, DEFAULT_CONFIG);
  for (const point of [[-1, 0, -1.8], [1, 0, 1.8], [0, 1.2, -2.22], [0, -0.23, 1.95]]) {
    const p = new Vector3(...point as [number, number, number]).project(camera);
    expect(Math.abs(p.x)).toBeLessThan(1);
    expect(Math.abs(p.y)).toBeLessThan(1);
  }
});
