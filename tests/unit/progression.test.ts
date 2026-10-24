import { describe, expect, it } from 'vitest';
import { advanceProgression } from '../../src/game/progression';
import { speedMultiplier } from '../../src/game/difficulty';
import { ballCountAtScore, ballRewardScore } from '../../src/game/milestones';

const empty = () => ({ appliedMilestones: [] as number[], ballGlowUntil: null, awardedBallCount: 0 });

describe('累計の進行', () => {
  it.each([[4, 6, 5], [9, 11, 10], [19, 21, 20], [29, 31, 30], [39, 41, 40]])('%i→%iで%iを一度だけ処理する', (before, after, threshold) => {
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
    expect(all.crossed).toEqual([...new Set([5, 10, 20, 30, 40, 70, 100, 130, 150, 160, 190, 210, 240, 270,
      ...Array.from({ length: 23 }, (_, i) => 50 + i * 4),
      ...Array.from({ length: 27 }, (_, i) => 140 + i * 3),
      ...Array.from({ length: 30 }, (_, i) => 220 + i * 2),
      ...Array.from({ length: 172 }, (_, i) => 280 + i)])].sort((a,b) => a-b));
    expect(all.addedBalls).toBe(461);
  });
  it('毎ラリー加速し、初期調整値と後半の有限上限を保つ', () => {
    expect(speedMultiplier(0)).toBe(1);
    expect(speedMultiplier(1)).toBeGreaterThan(1);
    expect(speedMultiplier(2)).toBeGreaterThan(speedMultiplier(1));
    expect(speedMultiplier(4)).toBeLessThan(speedMultiplier(5));
    expect(speedMultiplier(5)).toBeCloseTo(1 + 1.6 * (1 - Math.exp(-5 / 90)), 12);
    expect(speedMultiplier(450)).toBeLessThan(2.6);
    expect(speedMultiplier(299)).toBeCloseTo(2.542283869875054, 12);
    expect(speedMultiplier(10000)).toBeCloseTo(2.605771613012495, 12);
    expect(speedMultiplier(10) - speedMultiplier(5)).toBeLessThan(speedMultiplier(5) - speedMultiplier(0));
  });
});


it('3ラリーごとの増球と表面解放を両方一度だけ適用する', () => {
  const first = advanceProgression(empty(), 149, 171, 12);
  expect(first.addedBalls).toBe(7);
  expect(first.crossed).toEqual([150, 152, 155, 158, 160, 161, 164, 167, 170]);
  expect(first.state.appliedMilestones).toEqual([150, 160]);
  expect(first.state.awardedBallCount).toBe(39);
  expect(advanceProgression(first.state, 149, 171, 13).addedBalls).toBe(0);
  const later = advanceProgression(first.state, 171, 181, 14);
  expect(later.addedBalls).toBe(3);
  expect(later.crossed).toEqual([173, 176, 179]);
  expect(later.state.appliedMilestones).toEqual([150, 160]);
});

it('新しい床と壁の節目も順序どおり処理する', () => {
  const all = advanceProgression(empty(), 0, 450, 12);
  expect(all.state.appliedMilestones).toEqual([10, 30, 40, 70, 100, 130, 150, 160, 190, 210, 240, 270, 300, 330, 360, 380, 390, 410, 420, 450]);
  expect(all.state.awardedBallCount).toBe(458);
});


describe('最新指定の増球タイミング', () => {
  it.each([[0, 1], [4, 1], [5, 2], [9, 2], [10, 3], [19, 3], [20, 4], [21, 4], [29, 4], [30, 5], [40, 6], [150, 33], [160, 36], [450, 459], [460, 489]])('%iラリーの無落球時は%i球', (score, count) => {
    expect(ballCountAtScore(score)).toBe(count);
  });
  it('初期報酬に続き段階表に沿って報酬スコアを逆引きする', () => {
    expect([1, 2, 3, 4, 16, 46, 47].map(ballRewardScore)).toEqual([5, 10, 20, 30, 90, 191, 194]);
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
