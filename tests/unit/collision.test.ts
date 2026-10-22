import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG as config } from '../../src/game/config';
import { paddleExitFraction, sweepPaddleHit } from '../../src/game/collision';
import { projectBall } from '../../src/game/viewpoint';

describe('見える移動区間と動く円形ラケットの接触', () => {
  const center = { x: 0, y: 0.5 };
  it('1刻みでラケットの左右を通り抜ける高速球も拾う', () => {
    const from = { x: -0.8, y: 0.5, z: config.paddleZ };
    const to = { x: 0.8, y: 0.5, z: config.paddleZ };
    const time = sweepPaddleHit(from, to, center, center, config)!;
    expect(time).toBeGreaterThan(0);
    expect(time).toBeLessThan(0.5);
    const x = from.x + (to.x - from.x) * time;
    const fromRadius = projectBall(from, config).radius, toRadius = projectBall(to, config).radius;
    // Off-center perspective gives the endpoint spheres different radii.
    expect(Math.abs(x)).toBeCloseTo(config.paddleRadius + fromRadius + (toRadius - fromRadius) * time, 7);
  });
  it('ラケット自身が球を横切る移動も相対移動として拾う', () => {
    const ball = { ...center, z: config.paddleZ };
    const hit = sweepPaddleHit(ball, ball, { x: -0.8, y: 0.5 }, { x: 0.8, y: 0.5 }, config);
    expect(hit).toBeGreaterThan(0);
    expect(hit).toBeLessThan(0.5);
  });
  it('球半径を含めた縁を拾い、離れた球は返さない', () => {
    const edge = { x: config.paddleRadius + config.ballRadius, y: 0.5, z: config.paddleZ };
    expect(sweepPaddleHit(edge, edge, center, center, config)).toBe(0);
    const outside = { ...edge, x: 0.3 };
    expect(sweepPaddleHit(outside, outside, center, center, config)).toBeNull();
  });
  it('奥行きが異なっても、投影上ラケットに重なる球を拾う', () => {
    const ball = { x: 0.4, y: 0.045, z: 0.858 };
    const projected = projectBall(ball, config);
    expect(projected.y).toBeGreaterThan(ball.y + 0.4);
    expect(sweepPaddleHit(ball, ball, projected, projected, config)).toBe(0);
    expect(sweepPaddleHit(ball, ball, { x: -0.5, y: 0.5 }, { x: -0.5, y: 0.5 }, config)).toBeNull();
  });
  it('操作平面を越えても、見える打球範囲に残る間は失球にしない', () => {
    expect(paddleExitFraction({ x: 0, y: 0.5, z: 1.95 }, { x: 0, y: 0.5, z: 2.1 }, config)).toBeNull();
    const exit = paddleExitFraction({ x: 0, y: 0.5, z: 2.1 }, { x: 0, y: -0.2, z: 2.8 }, config)!;
    expect(exit).toBeGreaterThan(0); expect(exit).toBeLessThan(1);
  });
});
