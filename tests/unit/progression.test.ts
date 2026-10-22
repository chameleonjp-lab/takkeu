import { describe, expect, it } from 'vitest';
import { advanceProgression } from '../../src/game/progression';
import { speedMultiplier } from '../../src/game/difficulty';

const empty = () => ({ appliedMilestones: [] as number[], ballGlowUntil: null });

describe('累計の進行', () => {
  it.each([[29, 31, 30], [49, 51, 50], [149, 151, 150]])('%i→%iで%iを一度だけ処理する', (before, after, threshold) => {
    const first = advanceProgression(empty(), before, after, 12);
    expect(first.crossed).toEqual([threshold]);
    expect(first.addedBalls).toBe(1);
    expect(first.speedTier).toBe(Math.floor(after / 5));
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
    expect(all.crossed).toEqual([10, 30, 50, 70, 100, 130, 150, 160, 190, 210, 240, 270, 300, 330, 360, 390, 420, 450]);
    expect(all.addedBalls).toBe(3);
  });
  it('加速は5ごと、後半ほど小さくなり2.2倍へ近づく', () => {
    expect(speedMultiplier(0)).toBe(1);
    expect(speedMultiplier(4)).toBe(1);
    expect(speedMultiplier(5)).toBeCloseTo(1 + 1.2 * (1 - Math.exp(-1 / 40)), 12);
    expect(speedMultiplier(450)).toBeLessThan(2.2);
    expect(speedMultiplier(10000)).toBeLessThanOrEqual(2.2);
    expect(speedMultiplier(10) - speedMultiplier(5)).toBeLessThan(speedMultiplier(5) - speedMultiplier(0));
  });
});
