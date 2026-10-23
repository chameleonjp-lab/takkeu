import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG as config, clampPaddle } from '../../src/game/config';
import { stepSimulation } from '../../src/game/simulation';
import type { InputSample, PaddlePoint } from '../../src/game/types';
import { projectBall } from '../../src/game/viewpoint';
import { bounceTime, sampleReturn } from '../../src/game/trajectory';
import { flightDuration } from '../../src/game/difficulty';
import { incoming, scenario } from '../helpers/scenarios';

const point = (x: number, y = 0.5): PaddlePoint => ({ x, y });
function fixture(now = 1.99) {
  const s = scenario(0, now);
  s.state.paddle = clampPaddle(point(-0.7), config);
  s.state.balls = [incoming(1, 2, point(0), now, 2)];
  return s;
}
function step(s: ReturnType<typeof fixture>, samples: InputSample[]) {
  return stepSimulation(s.state, config, config.fixedDt, { target: s.state.paddle, samples });
}
const sample = (kind: 'place' | 'move' | 'release', at: number, x: number, y = .5) => ({ kind, at, target: point(x, y) });

describe('時刻付き絶対操作と可視接触', () => {
  it('配置の瞬間移動経路では返さず、指定時刻から新位置に留まる', () => {
    const s = fixture(), t = s.state.simTime + .003;
    const result = step(s, [sample('place', t, .7)]);
    expect(result.snapshot.paddle).toEqual(point(.7));
    expect(result.events.filter(e => e.kind === 'player-hit')).toHaveLength(0);
  });
  it('配置先の正当な重なりは配置時刻に返す', () => {
    const s = fixture(), t = s.state.simTime + .003;
    const result = step(s, [sample('place', t, 0)]);
    const hit = result.events.find(e => e.kind === 'player-hit');
    expect(hit?.time).toBeCloseTo(t, 12);
    expect(hit?.position).toEqual({ ...point(0), z: config.paddleZ });
  });
  it('ドラッグで球を横切る経路は入力後だけを調べ、終端は目標に一致する', () => {
    const s = fixture(), t = s.state.simTime + .004;
    const result = step(s, [sample('move', t, .7)]);
    const hit = result.events.find(e => e.kind === 'player-hit');
    expect(hit?.time).toBeGreaterThanOrEqual(t);
    expect(hit?.time).toBeLessThan(s.state.simTime);
    expect(result.snapshot.paddle).toEqual(point(.7));
  });
  it('同じ刻みのdown→move→releaseを最後の目標にまとめず処理する', () => {
    const s = fixture(), t = s.state.simTime;
    const result = step(s, [sample('place', t + .001, -.7), sample('move', t + .002, .7), sample('release', t + .004, .7)]);
    expect(result.events.filter(e => e.kind === 'player-hit')).toHaveLength(1);
    expect(result.events.find(e => e.kind === 'player-hit')!.time).toBeGreaterThanOrEqual(t + .002);
    expect(result.events.find(e => e.kind === 'player-hit')!.time).toBeLessThanOrEqual(t + .004);
    expect(step(s, []).snapshot.paddle).toEqual(point(.7));
    expect(s.state.score).toBe(1);
  });
  it('同時刻のmove→releaseでも通常ドラッグの経路を保持する', () => {
    const s = fixture(), t = s.state.simTime + .003;
    const result = step(s, [sample('place', t, -.7), sample('move', t, .7), sample('release', t, .7)]);
    expect(result.events.filter(e => e.kind === 'player-hit')).toHaveLength(1);
    expect(result.snapshot.paddle).toEqual(point(.7));
  });
  it.each([1, 2])('release→同時刻の再配置でも直前のドラッグ終端接触を確定する（%i球）', count => {
    const s = fixture(), t = 1.994, ball = s.state.balls[0]!;
    if (count === 2) s.state.balls.push({ ...ball, id: 2, plan: { ...ball.plan, ballId: 2 } });
    const p = projectBall(sampleReturn(ball.plan, ball.from, t), config);
    const tangent = { x: p.x - config.paddleRadius - p.radius, y: p.y };
    const result = step(s, [{ kind: 'move', at: 1.99, target: tangent }, { kind: 'release', at: t, target: tangent }, sample('place', t, .7, .85)]);
    const hits = result.events.filter(e => e.kind === 'player-hit');
    expect(hits.map(e => e.ballId)).toEqual(count === 2 ? [1, 2] : [1]);
    for (const hit of hits) expect(hit.time).toBeCloseTo(t, 12);
    expect(result.snapshot.paddle).toEqual(point(.7, .85));
  });
  it('同時刻ドラッグの発光位置も終点ではなく接触時のラケット中心を使う', () => {
    const s = fixture(); s.state.score = 519;
    const ball = s.state.balls[0]!, p = projectBall(ball.position, config);
    const result = step(s, [sample('move', 1.99, .7), sample('release', 1.99, .7)]);
    const hit = result.events.find(e => e.kind === 'player-hit')!;
    expect(hit.effect).toBe('racket-firework');
    expect(hit.position!.x).toBeLessThan(0);
    expect(Math.hypot(hit.position!.x - p.x, hit.position!.y - p.y)).toBeCloseTo(config.paddleRadius + p.radius, 10);
  });
  it('離した後も最終位置のラケットで接触できる', () => {
    const s = fixture(1.42), t = s.state.simTime;
    const p = projectBall(sampleReturn(s.state.balls[0]!.plan, s.state.balls[0]!.from, 1.44), config);
    step(s, [{ kind: 'place', at: t, target: p }, { kind: 'release', at: t + .001, target: p }]);
    const events = Array.from({ length: 6 }, () => step(s, []).events).flat();
    expect(events.filter(e => e.kind === 'player-hit')).toHaveLength(1);
    expect(s.state.paddle).toEqual(clampPaddle(p, config));
  });
  it('バウンドと配置が同時ならバウンド→新位置の接触となる', () => {
    const s = fixture(1.437), ball = s.state.balls[0]!, t = bounceTime(ball.plan);
    const p = projectBall(sampleReturn(ball.plan, ball.from, t), config);
    const result = step(s, [{ kind: 'place', at: t, target: p }]);
    expect(result.events.slice(0, 2).map(e => e.kind)).toEqual(['table-bounce', 'player-hit']);
    expect(result.events[1]!.time).toBeCloseTo(t, 12);
  });
  it('バウンド前の重なり・outgoing・lostは配置しても返球しない', () => {
    for (const phase of ['incoming', 'outgoing', 'lost'] as const) {
      const s = fixture(1), ball = s.state.balls[0]!;
      ball.phase = phase;
      const t = s.state.simTime + .002;
      const p = projectBall(sampleReturn(ball.plan, ball.from, t), config);
      expect(step(s, [{ kind: 'place', at: t, target: p }]).events.filter(e => e.kind === 'player-hit')).toHaveLength(0);
    }
  });
  it('入力前に失った球を配置やドラッグで復活させない', () => {
    const s = fixture(3);
    const result = step(s, [sample('place', 3.004, 0, .15), sample('move', 3.006, .7)]);
    expect(result.events.filter(e => e.kind === 'ball-lost')).toHaveLength(1);
    expect(result.events.filter(e => e.kind === 'player-hit')).toHaveLength(0);
    expect(result.snapshot.phase).toBe('gameover');
  });
  it('入力後の移動でも実際に重ならない高さの球は返さない', () => {
    const s = fixture(); s.state.paddle = point(-.7, .85);
    expect(step(s, [sample('move', 1.992, .7, .85)]).events.filter(e => e.kind === 'player-hit')).toHaveLength(0);
  });
  it('未来・NaN・確定済み区間の入力を計算へ混入させない', () => {
    const s = fixture();
    step(s, [sample('place', 1, 0), sample('place', 2.5, 0), sample('move', NaN, .7), sample('move', 1.992, NaN)]);
    expect(s.state.paddle).toEqual(clampPaddle(point(-.7), config));
    expect(s.state.score).toBe(0);
  });
  it('現行最速の漸近球速・540以後スマッシュでも有効接触を拾い二重得点しない', () => {
    const duration = flightDuration(config, Infinity, true);
    expect(duration).toBeCloseTo(2 / 2.6 / 1.6, 10);
    const s = fixture(2 - duration * .12);
    s.state.balls = [incoming(1, 2, point(0), s.state.simTime, duration)];
    s.state.balls[0]!.plan = { ...s.state.balls[0]!.plan, smash: true, speedScore: 10000, speedMultiplier: 2.6, smashMultiplier: 1.6 };
    const t = s.state.simTime + .002;
    const p = projectBall(sampleReturn(s.state.balls[0]!.plan, s.state.balls[0]!.from, t), config);
    const result = step(s, [{ kind: 'place', at: t, target: p }]);
    expect(result.events.filter(e => e.kind === 'player-hit')).toHaveLength(1);
    const more = Array.from({ length: 10 }, () => step(s, []).events).flat();
    expect(more.filter(e => e.kind === 'player-hit')).toHaveLength(0);
  });
});

it.each([false, true])('同時刻の複数球はバウンドを先に、同種はball id順で処理する（反転%s）', reverse => {
  const s = fixture(1.437), first = s.state.balls[0]!;
  s.state.balls = [first, { ...first, id: 2, plan: { ...first.plan, ballId: 2 } }];
  if (reverse) s.state.balls.reverse();
  const t = bounceTime(first.plan), target = projectBall(sampleReturn(first.plan, first.from, t), config);
  const result = step(s, [{ kind: 'place', at: t, target }]);
  expect(result.events.filter(e => ['table-bounce', 'player-hit'].includes(e.kind)).map(e => [e.kind, e.ballId])).toEqual([
    ['table-bounce', 1], ['table-bounce', 2], ['player-hit', 1], ['player-hit', 2],
  ]);
});

it('同じ固定区間内の高速通過と遅い配置を区別し、確定前でも入力前には当てない', () => {
  // Deliberately faster than the real speed cap: a post-bounce flight traverses
  // the racket in one tick. This is separate from the configured-fastest test.
  const make = () => {
    const s = fixture(1);
    const duration = .02, departAt = 1 - .75 * duration;
    const ball = incoming(1, departAt + duration, point(2, .5), 1, duration);
    ball.from = { x: -8, y: .5, z: config.paddleZ };
    ball.plan = { ...ball.plan, bounceY: .5 };
    ball.position = sampleReturn(ball.plan, ball.from, 1);
    s.state.balls = [ball]; s.state.paddle = point(0, .5);
    return s;
  };
  const hold = make();
  expect(step(hold, []).events.filter(e => e.kind === 'player-hit')).toHaveLength(1);
  const late = make(); late.state.paddle = point(.7, .85);
  const result = step(late, [sample('place', 1.007, 0, .5)]);
  expect(result.events.filter(e => e.kind === 'player-hit')).toHaveLength(0);
});
