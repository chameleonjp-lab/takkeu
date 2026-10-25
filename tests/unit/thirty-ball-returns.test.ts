import { expect, it } from 'vitest';
import { DEFAULT_CONFIG, INITIAL_PADDLE } from '../../src/game/config';
import { chooseOpponentTarget } from '../../src/game/targets';
import { incoming, scenario } from '../helpers/scenarios';
import { missPaddle, waitingBall } from '../helpers/remainingBall';
import type { GameEvent } from '../../src/game/types';

it.each([100, 300, 450, 540, 555])('%iで相手へ同時到達した30球が全て返球され、順番待ちに残らない', score => {
  const s = scenario(score), events: GameEvent[] = [];
  s.state.balls = Array.from({ length: 30 }, (_, i) => {
    const b = incoming(i + 1, 20.001, { x: (i - 14.5) / 20, y: 0.5 });
    return { ...b, phase: 'outgoing', from: { x: 0, y: 0.5, z: DEFAULT_CONFIG.paddleZ }, plan: { ...b.plan, landingZ: -DEFAULT_CONFIG.paddleZ } };
  });
  const until = score >= 450 ? 20.42 : 20.02;
  while (s.state.simTime < until) events.push(...s.step(missPaddle).events);
  const strokes = events.filter(e => e.kind === 'opponent-hit');
  expect(new Set(strokes.map(e => e.ballId)).size).toBe(30);
  expect(s.snapshot().balls).toHaveLength(30);
  expect(s.snapshot().balls.every(b => b.phase === 'incoming')).toBe(true);
  for (const stroke of strokes) {
    expect(stroke.time).toBeCloseTo(score >= 450 ? 20.401 : 20.001, 10);
    if (score >= 450) {
      const warning = events.find(e => e.kind === 'smash-warning' && e.ballId === stroke.ballId)!;
      expect(stroke.time - warning.time).toBeCloseTo(0.4, 10);
    }
  }
});

it.each([29, 30])('140→141で生存%i球の増球は空き枠だけに適用する', count => {
  const s = scenario(140);
  s.state.nextBallId = 100;
  s.state.balls = [incoming(1, 20.001), ...Array.from({ length: count - 1 }, (_, i) => waitingBall(i + 2, 140, 1000))];
  s.step();
  expect(s.state.score).toBe(141);
  expect(s.snapshot().balls).toHaveLength(30);
  expect(s.snapshot().balls.some(b => b.id === 100)).toBe(count === 29);
});

it('満杯で見送った報酬は持ち越さず、失球後は次の3ラリー報酬で1球だけ増やす', () => {
  const s = scenario(140);
  s.state.nextBallId = 100;
  s.state.balls = [incoming(1, 20.001), ...Array.from({ length: 29 }, (_, i) => waitingBall(i + 2, 140, 1000))];
  s.step();
  expect(s.snapshot().balls).toHaveLength(30);
  s.state.balls[1]!.phase = 'lost'; s.step();
  expect(s.snapshot().balls).toHaveLength(29);
  s.state.score = 143;
  s.state.balls[0] = incoming(1, s.state.simTime + 0.001, INITIAL_PADDLE, s.state.simTime);
  s.step();
  expect(s.state.score).toBe(144);
  expect(s.snapshot().balls).toHaveLength(30);
  expect(s.state.nextBallId).toBe(101);
});

it('返球元は3帯の巡回ではなく連続した位置に散り、同じ帯からも連続して返る', () => {
  const source = { randomState: 7, lastTargetBand: 1 }, bins = new Set<number>();
  let repeated = 0, previous = -1;
  for (let i = 0; i < 500; i++) {
    const p = chooseOpponentTarget(source, DEFAULT_CONFIG);
    expect(Math.abs(p.x)).toBeLessThanOrEqual(0.9);
    bins.add(Math.floor((p.x + 0.9) / 0.15));
    const band = p.x < -0.35 ? 0 : p.x > 0.35 ? 2 : 1;
    if (band === previous) repeated++;
    previous = band;
  }
  expect(bins.size).toBe(12);
  expect(repeated).toBeGreaterThan(20);
});
