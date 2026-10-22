import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG as config } from '../../src/game/config';
import { sweepPaddleHit } from '../../src/game/collision';

describe('移動区間と動く円形ラケットの接触', () => {
  const center = { x: 0, y: 0.5 };
  it('1刻みで平面を飛び越える高速球も最初の接触時刻を返す', () => {
    const time = sweepPaddleHit({ ...center, z: 0 }, { ...center, z: 4 }, center, center, config);
    expect(time).toBeCloseTo((config.paddleZ - config.ballRadius) / 4, 7);
  });
  it('ラケット自身の移動を相対移動として扱う', () => {
    const hit = sweepPaddleHit({ x: 0, y: 0.5, z: 1.5 }, { x: 0, y: 0.5, z: 2.4 }, { x: -0.8, y: 0.5 }, { x: 0.8, y: 0.5 }, config);
    expect(hit).not.toBeNull();
    expect(hit).toBeGreaterThan(0);
    expect(hit).toBeLessThan(1);
  });
  it('球半径を含めた円の縁の接触を拾う', () => {
    const x = config.paddleRadius + config.ballRadius;
    expect(sweepPaddleHit({ x, y: 0.5, z: 1.5 }, { x, y: 0.5, z: 2.4 }, center, center, config)).toBeCloseTo(0.5, 5);
  });
  it('円形の範囲外や平面に届かない球は接触にしない', () => {
    expect(sweepPaddleHit({ x: 0.246, y: 0.5, z: 1.5 }, { x: 0.246, y: 0.5, z: 2.4 }, center, center, config)).toBeNull();
    expect(sweepPaddleHit({ ...center, z: 0 }, { ...center, z: 1 }, center, center, config)).toBeNull();
    expect(sweepPaddleHit({ ...center, z: 1.95 }, { ...center, z: 1.95 }, center, center, config)).toBe(0);
  });
});
