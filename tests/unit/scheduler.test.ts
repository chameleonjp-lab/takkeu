import { describe, expect, it } from 'vitest';
import { clampPaddle, DEFAULT_CONFIG } from '../../src/game/config';
import { scheduleReturn } from '../../src/game/scheduler';
import type { PaddlePoint, ReturnPlan } from '../../src/game/types';

const request = (ballId: number, target: PaddlePoint, earliestDepartAt = 0) => ({ ballId, earliestDepartAt, preferredTarget: target, speedMultiplier: 2.2, smash: false });

describe('球ごとの独立した返球時刻', () => {
  it('30球が異なる位置を狙っても他球の到着待ちを発生させない', () => {
    const plans: ReturnPlan[] = [];
    for (let id = 1; id <= 30; id++) plans.push(scheduleReturn(request(id, { x: id % 2 ? -1 : 1, y: 0.5 }), plans, DEFAULT_CONFIG));
    for (const p of plans) { expect(p.departAt).toBeCloseTo(0, 10); expect(p.arriveAt).toBeCloseTo(2 / 2.2, 10); }
  });
  it('他球の確定予約を変えず、自分の準備完了時刻で返す', () => {
    const a = scheduleReturn(request(1, { x: -1, y: 0.2 }), [], DEFAULT_CONFIG);
    const b = scheduleReturn(request(2, { x: 1, y: 0.8 }, 1), [a], DEFAULT_CONFIG);
    const before = structuredClone([a, b]);
    const inserted = scheduleReturn(request(3, { x: 0.8, y: 0.2 }, 0.35), [a, b], DEFAULT_CONFIG);
    expect(inserted.departAt).toBeCloseTo(0.35, 10);
    expect([a, b]).toEqual(before);
  });
  it('通常の視認時間と明示した最早到着時刻を守る', () => {
    const plan = scheduleReturn({ ...request(1, { x: 9, y: -3 }, 10), earliestArriveAt: 11 }, [], DEFAULT_CONFIG);
    expect(plan.arriveAt - plan.netCrossAt).toBeCloseTo(1 / 2.2, 10);
    expect(plan.arriveAt).toBeGreaterThanOrEqual(11);
    expect(plan.target).toEqual(clampPaddle({ x: 99, y: -99 }, DEFAULT_CONFIG));
  });
  it('同時スマッシュでも各球の0.4秒予告を省略しない', () => {
    const plans: ReturnPlan[] = [];
    for (let id = 1; id <= 30; id++) plans.push(scheduleReturn({ ...request(id, { x: 0, y: 0.5 }, 10), smash: true }, plans, DEFAULT_CONFIG));
    for (const p of plans) { expect(p.warningAt).toBeCloseTo(10, 10); expect(p.departAt).toBeCloseTo(10.4, 10); }
  });
});
