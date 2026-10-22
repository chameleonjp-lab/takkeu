import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { DEFAULT_CONFIG } from '../../src/game/config';
import { createCamera, fitCamera } from '../../src/render/camera';
import { projectBall } from '../../src/game/viewpoint';

it('手前が広く奥が狭い遠近感を持つ', () => {
  const camera = createCamera(); fitCamera(camera, 390, 550, DEFAULT_CONFIG);
  const front = new Vector3(1, 0, 1.8).project(camera);
  const back = new Vector3(1, 0, -1.8).project(camera);
  expect(front.x).toBeGreaterThan(back.x * 1.5);
});

it.each([[390, 550], [900, 250], [1280, 720]])('描画と接触用の球投影が%ix%iで一致する', (w, h) => {
  const camera = createCamera(); fitCamera(camera, w, h, DEFAULT_CONFIG);
  for (const point of [[0.6, 0.045, 0.858], [-0.8, 0.6, 1.5], [0.4, 0.4, 2.3]]) {
    const ball = new Vector3(...point as [number, number, number]);
    const mapped = projectBall(ball, DEFAULT_CONFIG);
    const visible = ball.project(camera);
    const contact = new Vector3(mapped.x, mapped.y, mapped.z).project(camera);
    expect(contact.x).toBeCloseTo(visible.x, 10);
    expect(contact.y).toBeCloseTo(visible.y, 10);
  }
});

it.each([[900, 390], [360, 440], [600, 220]])('全解放後の相手の姿と両コートを%ix%iでも画面に収める', (w, h) => {
  const camera = createCamera(); fitCamera(camera, w, h, DEFAULT_CONFIG);
  for (const point of [[-1, 0, -1.8], [1, 0, 1.8], [0, 1.2, -2.22], [0, -0.23, 1.95]]) {
    const p = new Vector3(...point as [number, number, number]).project(camera);
    expect(Math.abs(p.x)).toBeLessThan(1);
    expect(Math.abs(p.y)).toBeLessThan(1);
  }
});
