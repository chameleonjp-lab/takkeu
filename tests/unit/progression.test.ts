import { describe, expect, it } from 'vitest';
import { advanceProgression } from '../../src/game/progression';
import { speedMultiplier } from '../../src/game/difficulty';
import { ballCountAtScore, ballRewardScore } from '../../src/game/milestones';

const empty = () => ({ appliedMilestones: [] as number[], ballGlowUntil: null, awardedBallCount: 0 });

describe('累計の進行', () => {
  it.each([[4, 6, 5], [9, 11, 10], [19, 21, 20], [29, 31, 30], [39, 41, 40], [149, 151, 150]])('%i→%iで%iを一度だけ処理する', (before, after, threshold) => {
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
    expect(all.crossed).toEqual([5, ...Array.from({ length: 45 }, (_, i) => (i + 1) * 10)]);
    expect(all.addedBalls).toBe(46);
  });
  it('毎ラリー加速し、初期調整値と上限2.6を保つ', () => {
    expect(speedMultiplier(0)).toBe(1);
    expect(speedMultiplier(1)).toBeGreaterThan(1);
    expect(speedMultiplier(2)).toBeGreaterThan(speedMultiplier(1));
    expect(speedMultiplier(4)).toBeLessThan(speedMultiplier(5));
    expect(speedMultiplier(5)).toBeCloseTo(1 + 1.6 * (1 - Math.exp(-5 / 90)), 12);
    expect(speedMultiplier(450)).toBeLessThan(2.6);
    expect(speedMultiplier(10000)).toBeLessThanOrEqual(2.6);
    expect(speedMultiplier(10) - speedMultiplier(5)).toBeLessThan(speedMultiplier(5) - speedMultiplier(0));
  });
});


it('10ごとの増球と表面解放を両方一度だけ適用する', () => {
  const first = advanceProgression(empty(), 149, 171, 12);
  expect(first.addedBalls).toBe(3);
  expect(first.crossed).toEqual([150, 160, 170]);
  expect(first.state.appliedMilestones).toEqual([150, 160]);
  expect(first.state.awardedBallCount).toBe(18);
  expect(advanceProgression(first.state, 149, 171, 13).addedBalls).toBe(0);
  const later = advanceProgression(first.state, 171, 181, 14);
  expect(later.addedBalls).toBe(1);
  expect(later.crossed).toEqual([180]);
  expect(later.state.appliedMilestones).toEqual([150, 160]);
});

it('新しい床と壁の節目も順序どおり処理する', () => {
  const all = advanceProgression(empty(), 0, 450, 12);
  expect(all.state.appliedMilestones).toEqual([10, 30, 40, 70, 100, 130, 150, 160, 190, 210, 240, 270, 300, 330, 360, 380, 390, 410, 420, 450]);
  expect(all.state.awardedBallCount).toBe(46);
});


describe('最新指定の増球タイミング', () => {
  it.each([[0, 1], [4, 1], [5, 2], [9, 2], [10, 3], [19, 3], [20, 4], [21, 4], [29, 4], [30, 5], [40, 6], [150, 17], [160, 18], [450, 47], [460, 48]])('%iラリーの無落球時は%i球', (score, count) => {
    expect(ballCountAtScore(score)).toBe(count);
  });
  it('追加報酬の1回目は5、2回目は10、その後10ごと', () => {
    expect([1, 2, 3, 4, 16, 46, 47].map(ballRewardScore)).toEqual([5, 10, 20, 30, 150, 450, 460]);
  });
  it('0→21でも5/10/20の3球だけを一度ずつ追加し、M10の発光を同時に開始する', () => {
    const first = advanceProgression(empty(), 0, 21, 12);
    expect(first.addedBalls).toBe(3);
    expect(first.crossed).toEqual([5, 10, 20]);
    expect(first.state.ballGlowUntil).toBe(17);
    const repeated = advanceProgression(first.state, 0, 21, 13);
    expect(repeated.addedBalls).toBe(0);
    expect(repeated.crossed).toEqual([]);
    expect(repeated.state.ballGlowUntil).toBe(17);
    const thirty = advanceProgression(first.state, 21, 30, 14);
    expect(thirty.addedBalls).toBe(1);
    expect(thirty.state.ballGlowUntil).toBeNull();
  });
});
