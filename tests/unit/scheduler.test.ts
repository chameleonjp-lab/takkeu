import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/game/config';
import { scheduleReturn } from '../../src/game/scheduler';
import type { PaddlePoint, ReturnPlan } from '../../src/game/types';

const request = (ballId: number, target: PaddlePoint, earliestDepartAt = 0) => ({ ballId, earliestDepartAt, preferredTarget: target, speedMultiplier: 2.2, smash: false });
const required = (a: ReturnPlan, b: ReturnPlan) => 0.12 + Math.hypot(a.target.x - b.target.x, a.target.y - b.target.y) / 6;
export function expectReachable(plans: readonly ReturnPlan[]) {
  const sorted = [...plans].sort((a, b) => a.arriveAt - b.arriveAt);
  for (let i = 1; i < sorted.length; i++) expect(sorted[i]!.arriveAt - sorted[i - 1]!.arriveAt + 1e-10).toBeGreaterThanOrEqual(required(sorted[i - 1]!, sorted[i]!));
}

describe('確定した到着予約', () => {
  it('4球が左右上下端を交互に狙っても、前後双方に移動できる', () => {
    const reserved: ReturnPlan[] = [];
    for (const [id, x, y] of [[1, -1.05, 0.15], [2, 1.05, 0.85], [3, -1.05, 0.85], [4, 1.05, 0.15]]) {
      reserved.push(scheduleReturn(request(id!, { x: x!, y: y! }), reserved, DEFAULT_CONFIG));
    }
    expectReachable(reserved);
    expect(reserved[3]!.departAt).toBeGreaterThan(0);
    expect(reserved.map(p => p.ballId)).toEqual([1, 2, 3, 4]);
  });
  it('空きの中へ挿入する時は後続予約にも余裕を残し、既存予約を変更しない', () => {
    const left = scheduleReturn(request(1, { x: -1, y: 0.2 }), [], DEFAULT_CONFIG);
    const right = scheduleReturn(request(2, { x: 1, y: 0.8 }, 1), [left], DEFAULT_CONFIG);
    const before = structuredClone([left, right]);
    const inserted = scheduleReturn(request(3, { x: -0.8, y: 0.2 }, 0.35), [left, right], DEFAULT_CONFIG);
    expect(inserted.arriveAt).toBeLessThan(right.arriveAt);
    expect([left, right]).toEqual(before);
    expectReachable([left, inserted, right]);
    const conflict = scheduleReturn(request(4, { x: 1, y: 0.8 }, 0.75), [left, inserted, right], DEFAULT_CONFIG);
    expectReachable([left, inserted, right, conflict]);
  });
  it('通常の最低視認時間0.60秒と追加から1秒を守る', () => {
    const plan = scheduleReturn({ ...request(1, { x: 9, y: -3 }, 10), earliestArriveAt: 11 }, [], DEFAULT_CONFIG);
    expect(plan.arriveAt - plan.netCrossAt).toBeCloseTo(0.6, 10);
    expect(plan.arriveAt).toBeGreaterThanOrEqual(11);
    expect(plan.target).toEqual({ x: 1.05, y: 0.15 });
    expect(plan.speedMultiplier).toBe(2.2);
  });
  it('同時候補が空きを待つ場合は受付順で予約される', () => {
    const plans: ReturnPlan[] = [];
    for (let id = 1; id <= 4; id++) plans.push(scheduleReturn(request(id, { x: 0, y: 0.5 }), plans, DEFAULT_CONFIG));
    expectReachable(plans);
    expect(plans.map(p => p.arriveAt)).toEqual(plans.map(p => p.arriveAt).sort((a, b) => a - b));
  });
});
