import { expect, it } from 'vitest';
import { sampleReturn } from '../../src/game/trajectory';
import { ballLostAt } from '../helpers/losses';
import { scenario } from '../helpers/scenarios';
import { missPaddle, waitingBall } from '../helpers/remainingBall';

it('copies distinct confirmed trajectory positions for each loss in one fixed step', () => {
  const s = scenario(340);
  const first = ballLostAt(1,20.002,20);
  const second = ballLostAt(2,20.006,20);
  second.from = { ...second.from, x: .65 };
  second.plan = { ...second.plan, target: { x: .65, y: .6 } };
  second.position = sampleReturn(second.plan,second.from,20);
  s.state.balls = [first,second,waitingBall(3,340,10000)];
  const result = s.step(missPaddle);
  const losses = result.events.filter(e => e.kind === 'ball-lost');
  expect(losses).toHaveLength(2);
  for (const event of losses) {
    const source = event.ballId === 1 ? first : second;
    expect(event.position).toEqual(sampleReturn(source.plan,source.from,event.time));
    expect(event.position).not.toBe(source.position);
  }
  expect(losses[0]!.position).not.toEqual(losses[1]!.position);
  expect(losses.map(e => e.lossCount)).toEqual([1,2]);
  const preserved = { ...losses[0]!.position! };
  first.from = { x: 99, y: 99, z: 99 };
  expect(losses[0]!.position).toEqual(preserved);
});

it('keeps the 100th loss coordinate when the final tick stops further physics', () => {
  const s = scenario(340); s.state.lostBallCount = 99;
  const lost = ballLostAt(1,20.002,20);
  s.state.balls = [lost,waitingBall(2,340,10000)];
  const result = s.step(missPaddle);
  const event = result.events.find(e => e.kind === 'ball-lost')!;
  expect(event).toMatchObject({lossCount:100,position:sampleReturn(lost.plan,lost.from,event.time)});
  expect(result.snapshot.phase).toBe('gameover');
  expect(result.events.filter(e => e.kind === 'game-over')).toHaveLength(1);
});
