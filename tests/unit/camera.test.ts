import { expect, it } from 'vitest';
import { Box3, Mesh, Vector3 } from 'three';
import { clampPaddle, DEFAULT_CONFIG } from '../../src/game/config';
import { createCamera, fitCamera } from '../../src/render/camera';
import { projectBall } from '../../src/game/viewpoint';
import { createObjects } from '../../src/render/objects';

it('手前が広く奥が狭い遠近感を持つ', () => {
  const camera = createCamera(); fitCamera(camera, 390, 550, DEFAULT_CONFIG);
  const front = new Vector3(1, 0, 1.8).project(camera);
  const back = new Vector3(1, 0, -1.8).project(camera);
  expect(front.x).toBeGreaterThan(back.x * 1.5);
});

it('全操作範囲でラケットの面と柄を画面内に保つ', () => {
  const camera = createCamera(); fitCamera(camera, 358, 250, DEFAULT_CONFIG);
  const objects = createObjects(DEFAULT_CONFIG);
  for (const y of [0.15, 0.5, 0.85]) for (const x of [-1.05, 0, 1.05]) {
    const paddle = clampPaddle({ x, y }, DEFAULT_CONFIG);
    objects.playerPaddle.position.set(paddle.x, paddle.y, DEFAULT_CONFIG.paddleZ);
    objects.playerPaddle.updateMatrixWorld(true);
    // A rotated circle's bounding box has empty corners beyond its silhouette.
    // Check the actual face/handle vertices that the GPU will render.
    objects.playerPaddle.traverse(child => {
      if (!(child instanceof Mesh)) return;
      const positions = child.geometry.attributes.position!;
      for (let i = 0; i < positions.count; i++) {
        const p = new Vector3().fromBufferAttribute(positions, i).applyMatrix4(child.matrixWorld).project(camera);
        expect(Math.abs(p.x)).toBeLessThan(1); expect(Math.abs(p.y)).toBeLessThan(1);
      }
    });
  }
  objects.dispose();
});

it.each([[225, 157], [600, 419], [358, 250]])('参考画像の低い視点と台の占有率を%ix%iで保つ', (w, h) => {
  const camera = createCamera(); fitCamera(camera, w, h, DEFAULT_CONFIG);
  const screen = (x: number, z: number) => {
    const p = new Vector3(x, 0, z).project(camera);
    return { x: (p.x + 1) * w / 2, y: (1 - p.y) * h / 2 };
  };
  const frontLeft = screen(-1, 1.8), frontRight = screen(1, 1.8);
  const backLeft = screen(-1, -1.8), backRight = screen(1, -1.8);
  const frontWidth = frontRight.x - frontLeft.x, backWidth = backRight.x - backLeft.x;
  // Reference: front/back width about 2.7, depth/front width about .44.
  // These measure the rendered table, rather than a particular camera setting.
  expect(frontWidth / backWidth).toBeGreaterThan(2.5);
  expect(frontWidth / backWidth).toBeLessThan(3);
  expect((frontLeft.y - backLeft.y) / frontWidth).toBeGreaterThan(0.39);
  expect((frontLeft.y - backLeft.y) / frontWidth).toBeLessThan(0.49);
  expect(frontWidth / w).toBeGreaterThan(0.80);
  expect(frontWidth / w).toBeLessThan(0.96);
  expect((backLeft.x + backRight.x - frontLeft.x - frontRight.x) / (2 * frontWidth)).toBeGreaterThan(0.07);
  const paddleLeft = new Vector3(-DEFAULT_CONFIG.paddleRadius, 0.5, DEFAULT_CONFIG.paddleZ).project(camera);
  const paddleRight = new Vector3(DEFAULT_CONFIG.paddleRadius, 0.5, DEFAULT_CONFIG.paddleZ).project(camera);
  expect((paddleRight.x - paddleLeft.x) * w / 2 / frontWidth).toBeLessThan(0.17);
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
  for (const point of [[-1, 0, -1.8], [1, 0, 1.8], [0, -0.23, 1.95]]) {
    const p = new Vector3(...point as [number, number, number]).project(camera);
    expect(Math.abs(p.x)).toBeLessThan(1);
    expect(Math.abs(p.y)).toBeLessThan(1);
  }
  const objects = createObjects(DEFAULT_CONFIG);
  // Check the rebuilt model and the actual raised smash pose, rather than the
  // old model's hard-coded head height.
  objects.opponentPaddle.position.y = 0.60;
  for (const object of [objects.opponentBody, objects.opponentPaddle]) {
    const box = new Box3().setFromObject(object);
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const p = new Vector3(x, y, z).project(camera);
      expect(Math.abs(p.x)).toBeLessThan(1); expect(Math.abs(p.y)).toBeLessThan(1);
    }
  }
  objects.dispose();
});

it.each([[390, 844], [844, 390], [1280, 720], [320, 568], [280, 360]])('viewport %ix%iで台と高さ別の全可動域を切らない', (w, h) => {
  const camera = createCamera(); fitCamera(camera, w, h, DEFAULT_CONFIG);
  const objects = createObjects(DEFAULT_CONFIG);
  for (const y of [.15, .25, .5, .7, .85]) for (const x of [-2, 2]) {
    const paddle = clampPaddle({ x, y }, DEFAULT_CONFIG);
    objects.playerPaddle.position.set(paddle.x, paddle.y, DEFAULT_CONFIG.paddleZ);
    objects.playerPaddle.updateMatrixWorld(true);
    objects.playerPaddle.traverse(child => {
      if (!(child instanceof Mesh)) return;
      const positions = child.geometry.attributes.position!;
      for (let i = 0; i < positions.count; i++) {
        const p = new Vector3().fromBufferAttribute(positions, i).applyMatrix4(child.matrixWorld).project(camera);
        expect(Math.abs(p.x), `x boundary ${x}, ${y}`).toBeLessThanOrEqual(1);
        expect(Math.abs(p.y), `y boundary ${x}, ${y}`).toBeLessThanOrEqual(1);
      }
    });
  }
  objects.dispose();
});
