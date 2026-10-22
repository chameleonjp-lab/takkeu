import { describe, expect, it } from 'vitest';
import { advanceProgression } from '../../src/game/progression';
import { speedMultiplier } from '../../src/game/difficulty';

const empty = () => ({ appliedMilestones: [] as number[], ballGlowUntil: null, awardedBallCount: 0 });

describe('累計の進行', () => {
  it.each([[29, 31, 30], [39, 41, 40], [149, 151, 150]])('%i→%iで%iを一度だけ処理する', (before, after, threshold) => {
    const first = advanceProgression(empty(), before, after, 12);
    expect(first.crossed).toEqual([threshold]);
    expect(first.addedBalls).toBe(1);
    expect(first.speedTier).toBe(after);
    expect(advanceProgression(first.state, before, after, 13).addedBalls).toBe(0);
    expect(advanceProgression(first.state, after, after + 1, 14).crossed).toEqual([]);
  });
  it('全節目を昇順に処理し、5秒と常時発光を競合させない', () => {
    const ten = advanceProgression(empty(), 9, 10, 12);
    expect(ten.state.ballGlowUntil).toBe(17);
    const thirty = advanceProgression(ten.state, 10, 30, 13);
    expect(thirty.state.ballGlowUntil).toBeNull();
    expect(thirty.state.appliedMilestones).toEqual([10, 30]);
    const all = advanceProgression(empty(), 0, 451, 20);
    expect(all.crossed).toEqual(Array.from(new Set([10, 30, 40, 70, 100, 130, ...Array.from({ length: 31 }, (_, i) => 150 + i * 10)])).sort((a, b) => a - b));
    expect(all.addedBalls).toBe(33);
  });
  it('毎ラリー加速し、5の倍数の倍率と上限2.2を保つ', () => {
    expect(speedMultiplier(0)).toBe(1);
    expect(speedMultiplier(1)).toBeGreaterThan(1);
    expect(speedMultiplier(2)).toBeGreaterThan(speedMultiplier(1));
    expect(speedMultiplier(4)).toBeLessThan(speedMultiplier(5));
    expect(speedMultiplier(5)).toBeCloseTo(1 + 1.2 * (1 - Math.exp(-1 / 40)), 12);
    expect(speedMultiplier(450)).toBeLessThan(2.2);
    expect(speedMultiplier(10000)).toBeLessThanOrEqual(2.2);
    expect(speedMultiplier(10) - speedMultiplier(5)).toBeLessThan(speedMultiplier(5) - speedMultiplier(0));
  });
});


it('150以降は10ごとに増球し、表面解放と両方を一度だけ適用する', () => {
  const first = advanceProgression(empty(), 149, 171, 12);
  expect(first.addedBalls).toBe(3);
  expect(first.crossed).toEqual([150, 160, 170]);
  expect(first.state.appliedMilestones).toEqual([150, 160]);
  expect(first.state.awardedBallCount).toBe(5);
  expect(advanceProgression(first.state, 149, 171, 13).addedBalls).toBe(0);
  const later = advanceProgression(first.state, 171, 181, 14);
  expect(later.addedBalls).toBe(1);
  expect(later.crossed).toEqual([180]);
  expect(later.state.appliedMilestones).toEqual([150, 160]);
});

it('新しい床と壁の節目も順序どおり処理する', () => {
  const all = advanceProgression(empty(), 0, 450, 12);
  expect(all.state.appliedMilestones).toEqual([10, 30, 40, 70, 100, 130, 150, 160, 190, 210, 240, 270, 300, 330, 360, 380, 390, 410, 420, 450]);
  expect(all.state.awardedBallCount).toBe(33);
});
