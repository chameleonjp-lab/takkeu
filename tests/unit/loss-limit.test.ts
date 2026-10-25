import { expect, it } from 'vitest';
import { DEFAULT_CONFIG, INITIAL_PADDLE } from '../../src/game/config';
import { createSession } from '../../src/game/session';
import { stepSimulation } from '../../src/game/simulation';
import { advance } from '../helpers/fixtures';
import { ballLostAt, lossLimitScenario } from '../helpers/losses';
import { incoming, scenario } from '../helpers/scenarios';
import { missPaddle, waitingBall } from '../helpers/remainingBall';
import type { GameEvent } from '../../src/game/types';

it('配列から失球を除いても落球数を累積し、100球目に残球があっても終了する', () => {
  const s = scenario(340), events: GameEvent[] = [];
  s.state.balls = [waitingBall(1, 340, 10000)];
  for (let i = 1; i <= 100; i++) {
    s.state.balls.push(ballLostAt(i + 1, s.state.simTime + 0.004, s.state.simTime));
    const result = s.step(missPaddle); events.push(...result.events);
    expect(result.snapshot.lostBallCount).toBe(i);
    expect(result.snapshot.balls).toHaveLength(1);
    expect(result.snapshot.phase).toBe(i < 100 ? 'running' : 'gameover');
  }
  expect(events.filter(e => e.kind === 'ball-lost')).toHaveLength(100);
  expect(events.filter(e => e.kind === 'game-over')).toHaveLength(1);
  const stopped = s.snapshot();
  expect(s.step().events).toEqual([]);
  expect(s.snapshot()).toEqual(stopped);
});

it.each([false, true])('同時落球が複数あっても100球目で打ち切り終了を重複しない（反転%s）', reverse => {
  const s = scenario(340);
  s.state.lostBallCount = 99;
  s.state.balls = [ballLostAt(1, 20.002, 20), ballLostAt(2, 20.002, 20), waitingBall(3, 340, 20.006)];
  if (reverse) s.state.balls.reverse();
  const result = s.step();
  expect(result.snapshot.lostBallCount).toBe(100);
  expect(result.snapshot.phase).toBe('gameover');
  expect(result.events.map(e => [e.kind, e.ballId])).toEqual([['ball-lost', 1], ['game-over', undefined]]);
  expect(result.events.at(-1)!.time).toBe(result.events[0]!.time);
  expect(result.snapshot.score).toBe(340);
});

it('100球目より前の返球得点を残し、それより後の入力は適用しない', () => {
  const s = scenario(340);
  s.state.lostBallCount = 99;
  s.state.balls = [incoming(1, 20.001), ballLostAt(2, 20.006, 20)];
  const result = stepSimulation(s.state, DEFAULT_CONFIG, DEFAULT_CONFIG.fixedDt, {
    target: INITIAL_PADDLE, samples: [{ at: 20.007, kind: 'place', target: { x: -0.8, y: 0.2 } }],
  });
  expect(result.snapshot.score).toBe(341);
  expect(result.snapshot.lostBallCount).toBe(100);
  expect(result.snapshot.phase).toBe('gameover');
  expect(result.snapshot.paddle).toEqual(INITIAL_PADDLE);
  expect(result.events.filter(e => e.kind === 'player-hit')).toHaveLength(1);
  expect(result.events.at(-1)!.kind).toBe('game-over');
});

it('100球目と最後の残球が同時でも終了イベントは一度だけ', () => {
  const s = scenario(340); s.state.lostBallCount = 99;
  s.state.balls = [ballLostAt(1, 20.004, 20)];
  const result = s.step(missPaddle);
  expect(result.snapshot.lostBallCount).toBe(100);
  expect(result.snapshot.balls).toHaveLength(0);
  expect(result.events.filter(e => e.kind === 'game-over')).toHaveLength(1);
});

it('一時停止中に落球を増やさず、再開後の100球目で終了する', () => {
  const s = lossLimitScenario(99, 340, 20); s.state.phase = 'paused';
  const paused = s.snapshot();
  expect(s.step().snapshot).toEqual(paused);
  s.state.phase = 'running';
  for (let i = 0; i < 4; i++) s.step(missPaddle);
  expect(s.snapshot().lostBallCount).toBe(100);
  expect(s.snapshot().phase).toBe('gameover');
});

it('既にlostの球を再計上せず、未処理の実際の落球だけを数える', () => {
  const s = lossLimitScenario(99, 340, 20);
  s.state.balls[1]!.phase = 'lost';
  const result = s.step(missPaddle);
  expect(result.snapshot.lostBallCount).toBe(99);
  expect(result.snapshot.phase).toBe('running');
});

it('残球0なら100未満でも終了し、新規開始時には落球数を0へ戻す', () => {
  const session = createSession(DEFAULT_CONFIG, 7); session.start();
  advance(session, 3, missPaddle);
  expect(session.snapshot().lostBallCount).toBe(1);
  expect(session.snapshot().phase).toBe('gameover');
  session.reset(7);
  expect(session.snapshot().lostBallCount).toBe(0);
  session.start();
  expect(session.snapshot().lostBallCount).toBe(0);
  expect(session.snapshot().balls).toHaveLength(1);
});
