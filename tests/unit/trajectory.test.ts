import { expect, it } from 'vitest';
import { sampleReturn } from '../../src/game/trajectory';
import type { ReturnPlan } from '../../src/game/types';

it('ネットを越えて台内で一度弾み、予約した打球地点へ届く', () => {
  const plan: ReturnPlan = { ballId: 1, departAt: 0, netCrossAt: 1.25, arriveAt: 2.5, target: { x: 0.6, y: 0.5 }, smash: false, warningAt: null, speedMultiplier: 1 };
  const from = { x: 0, y: 0.5, z: -1.95 };
  expect(sampleReturn(plan, from, 0)).toEqual(from);
  const net = sampleReturn(plan, from, 1.25);
  expect(net.z).toBeCloseTo(0);
  expect(net.y).toBeGreaterThan(0.18 + 0.045);
  const bounce = sampleReturn(plan, from, 2.5 * 0.72);
  expect(bounce.y).toBeCloseTo(0.045);
  expect(bounce.z).toBeGreaterThan(0);
  expect(bounce.z).toBeLessThan(1.8);
  expect(sampleReturn(plan, from, 1.79).y).toBeGreaterThan(bounce.y);
  expect(sampleReturn(plan, from, 1.81).y).toBeGreaterThan(bounce.y);
  expect(sampleReturn(plan, from, 2.5)).toEqual({ ...plan.target, z: 1.95 });
});
