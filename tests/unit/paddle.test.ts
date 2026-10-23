import { expect, it } from 'vitest';
import { Box3, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import { DEFAULT_CONFIG as config } from '../../src/game/config';
import { createPaddle } from '../../src/render/paddle';
import { createObjects } from '../../src/render/objects';

it.each([0xef252e, 0x285be4])('柄がラバー面を突き抜けない（%i）', color => {
  const paddle = createPaddle(config, color, -0.56);
  paddle.group.updateMatrixWorld(true);
  // Cast onto the part of the rubber where the handle joins the blade.
  // A thick round handle used to be closer than the rubber on both sides.
  for (const side of [-1, 1]) {
    const origin = paddle.body.localToWorld(new Vector3(0, -config.paddleRadius + 0.012, side));
    const ray = new Raycaster(origin, new Vector3(0, 0, -side));
    const first = ray.intersectObject(paddle.body)[0]!.object as Mesh;
    expect((first.material as MeshStandardMaterial).color.getHex()).toBe(side === 1 ? color : 0x26282a);
  }
  paddle.group.traverse(child => {
    if (!(child instanceof Mesh)) return;
    child.geometry.dispose();
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) material.dispose();
  });
});

it('相手の打球点の球はラバー面に埋まらず、その手前で接する', () => {
  const objects = createObjects(config);
  const blade = new Box3().setFromObject(objects.opponentPaddle);
  // Both outgoing endpoints and new incoming flights use this ball centre.
  // The nearest rubber surface must touch its back, not cross its centre.
  expect(blade.max.z).toBeCloseTo(-config.paddleZ - config.ballRadius, 10);
  objects.dispose();
});
