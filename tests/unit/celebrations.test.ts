import { expect, it } from 'vitest';
import { createCelebrations, lossCelebration, rallyCelebration, celebrationFrame, celebrationEnd, isRepdigit } from '../../src/game/celebrations';
import { ballLostAt } from '../helpers/losses';
import { incoming, scenario } from '../helpers/scenarios';
import { waitingBall, missPaddle } from '../helpers/remainingBall';

it('2秒以内の連続落球で電撃の数・大きさを増し、4球目から台を揺らす', () => {
  let state = createCelebrations();
  let previous = celebrationFrame(state, 0);
  for (let count = 1; count <= 10; count++) {
    state = lossCelebration(state, count, count * 2);
    const frame = celebrationFrame(state, count * 2 + .05);
    expect(state.lossStreak).toBe(count);
    expect(frame.netBolts).toBeGreaterThan(previous.netBolts);
    expect(frame.netSize).toBeGreaterThan(previous.netSize);
    expect(frame.shake > 0).toBe(count >= 4);
    previous = frame;
  }
  state = lossCelebration(state, 11, 22.001);
  expect(state.lossStreak).toBe(1);
  expect(celebrationFrame(state, 23).netBolts).toBe(0);
});

it('同じ刻みの10・20・30も保持し、55・77・88・99は指定色と虹色を3秒間交互に表示', () => {
  let state = createCelebrations();
  for (let n = 1; n <= 30; n++) state = lossCelebration(state, n, 5);
  expect(celebrationFrame(state, 5).numbers.map(n => n.value)).toEqual([10, 20, 30]);
  expect(celebrationFrame(state, 7).numbers).toEqual([]);
  for (const [value, color] of [[55, 'black'], [77, 'blue'], [88, 'green'], [99, 'gold']] as const) {
    const special = lossCelebration(createCelebrations(), value, 10);
    expect(celebrationFrame(special, 10).numbers[0]).toMatchObject({ value, palette: 'rainbow' });
    expect(celebrationFrame(special, 10.31).numbers[0]).toMatchObject({ value, palette: color });
    expect(celebrationFrame(special, 12.99).numbers).toHaveLength(1);
    expect(celebrationFrame(special, 13).numbers).toHaveLength(0);
    expect(celebrationEnd(special)).toBe(13);
  }
});

it('ゾロ目と100単位の5秒演出を別々に保持し、再開始で初期化する', () => {
  for (const n of [11,22,99,111,222,999,1111]) expect(isRepdigit(n)).toBe(true);
  for (const n of [0,1,9,10,100,101,110,NaN]) expect(isRepdigit(n)).toBe(false);
  const state = rallyCelebration(rallyCelebration(createCelebrations(), 99, 5), 100, 6);
  expect(celebrationFrame(state, 9.99)).toMatchObject({ edgeElectric: true, environment: 'gold' });
  expect(celebrationFrame(state, 10).edgeElectric).toBe(false);
  expect(celebrationFrame(state, 10.99).environment).not.toBe(null);
  expect(celebrationFrame(state, 11).environment).toBe(null);
  expect(celebrationEnd(state)).toBe(11);
  expect(celebrationEnd(createCelebrations())).toBe(0);
});

it('実際の得点と落球から時刻を記録し、100球目の最終演出も終了前に記録する', () => {
  const s = scenario(99);
  s.state.balls = [incoming(1,20.001), waitingBall(3,99,10000)];
  const scored = s.step();
  expect(scored.snapshot.celebrations.centuryScore).toBe(100);
  expect(scored.snapshot.celebrations.centuryAt).toBe(scored.events.find(e => e.kind === 'player-hit')!.time);
  s.state.lostBallCount = 99;
  s.state.balls.push(ballLostAt(2,s.state.simTime+.002,s.state.simTime));
  const lost = s.step(missPaddle);
  expect(lost.snapshot.phase).toBe('gameover');
  expect(lost.snapshot.celebrations.numberNotices.map(n => n.value)).toEqual([100]);
  expect(lost.snapshot.celebrations.lastLossAt).toBe(lost.events.find(e => e.kind === 'ball-lost')!.time);
  // Public snapshots cannot mutate the simulation's effect history.
  (lost.snapshot.celebrations.numberNotices as {value:number;at:number}[])[0]!.value = 7;
  expect(s.snapshot().celebrations.numberNotices[0]!.value).toBe(100);
});
