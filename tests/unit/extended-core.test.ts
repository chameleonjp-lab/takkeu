import { describe, expect, it } from 'vitest';
import { createLoop } from '../../src/app/loop';
import { DEFAULT_CONFIG, INITIAL_PADDLE } from '../../src/game/config';
import { speedMultiplier } from '../../src/game/difficulty';
import { chooseReturnKind, planOpponentReturn } from '../../src/game/opponent';
import { createSession } from '../../src/game/session';
import { sampleReturn } from '../../src/game/trajectory';
import { createInputTimeline } from '../../src/input/timeline';
import { incoming, scenario } from '../helpers/scenarios';

describe('短い描画遅延ではプレイを続ける', () => {
  const setup = () => {
    const session = createSession(DEFAULT_CONFIG, 7); session.start();
    const pauses: string[] = [];
    const loop = createLoop({ session, config: DEFAULT_CONFIG, timeline: createInputTimeline(INITIAL_PADDLE), onEvents() {}, onPause: reason => pauses.push(reason) });
    loop.resetClock(0); return { session, loop, pauses };
  };
  it('200msや900msの遅れは続行し、1回の追いつきは100ms以内', () => {
    const s = setup(); s.loop.frame(200);
    expect(s.session.snapshot().phase).toBe('running');
    expect(s.session.snapshot().simTime).toBeCloseTo(0.1, 10);
    s.loop.frame(1100);
    expect(s.session.snapshot().phase).toBe('running');
    expect(s.session.snapshot().simTime).toBeCloseTo(0.2, 10);
    expect(s.pauses).toEqual([]);
  });
  it('捨てた遅延を同じ時刻の入力や次のフレームで再消費しない', () => {
    const s = setup(); s.loop.frame(900);
    const first = s.session.snapshot().simTime;
    s.loop.flushInput(900); s.loop.frame(900);
    expect(s.session.snapshot().simTime).toBe(first);
    s.loop.frame(920);
    expect(s.session.snapshot().simTime - first).toBeCloseTo(2 * DEFAULT_CONFIG.fixedDt, 10);
  });
  it('描画の間に多数の入力が配送されても、合計12刻みの予算を共有する',()=>{
    const single=setup(),queued=setup();single.loop.frame(900);
    for(let time=100;time<=900;time+=100){queued.loop.flushInput(time);expect(queued.loop.toSimTime(time)).toBeLessThanOrEqual(.1+1e-10);}
    queued.loop.frame(900);expect(queued.session.snapshot().simTime).toBe(single.session.snapshot().simTime);
    queued.loop.frame(920);expect(queued.session.snapshot().simTime).toBeCloseTo(.1+2*DEFAULT_CONFIG.fixedDt,10);
  });
  it('1.5秒を超す本当の中断は停止し、手動で再開するまで進めない', () => {
    const s = setup(); s.loop.frame(20); const before = s.session.snapshot();
    s.loop.frame(1521);
    expect(s.session.snapshot()).toMatchObject({ phase: 'paused', simTime: before.simTime, pauseReason: 'slow-frame' });
    s.loop.frame(5000); expect(s.session.snapshot().simTime).toBe(before.simTime);
    expect(s.pauses).toEqual(['slow-frame']);
  });
});

describe('初速と全球の毎ラリー加速', () => {
  it('基準視認時間は1秒、従来より早く速度が上がる', () => {
    expect(DEFAULT_CONFIG.normalVisibleSeconds).toBe(1);
    expect(speedMultiplier(0)).toBe(1);
    expect(speedMultiplier(10)).toBeGreaterThan(1.1);
    expect(speedMultiplier(50)).toBeGreaterThan(1.5);
    expect(speedMultiplier(101)).toBeGreaterThan(speedMultiplier(100));
  });
  it.each([1, 299, 300])('別の球の得点で飛行中の往復球も加速し、現在位置は変わらない（%i）', score => {
    const s = scenario(score);
    const back = incoming(2, 21);
    const out = { ...incoming(3, 21), phase: 'outgoing' as const, from: { x: 0.4, y: 0.5, z: DEFAULT_CONFIG.paddleZ } };
    out.plan = { ...out.plan, landingZ: -DEFAULT_CONFIG.paddleZ };
    s.state.balls = [incoming(1, 20.002), back, out];
    const at = 20 + DEFAULT_CONFIG.fixedDt;
    const original = [back, out].map(ball => ({ id: ball.id, plan: structuredClone(ball.plan), from: { ...ball.from }, position: sampleReturn(ball.plan, ball.from, at) }));
    s.step(); expect(s.state.score).toBe(score + 1);
    for (const old of original) {
      const ball = s.state.balls.find(b => b.id === old.id)!;
      expect(ball.position.x).toBeCloseTo(old.position.x, 10);
      expect(ball.position.y).toBeCloseTo(old.position.y, 10);
      expect(ball.position.z).toBeCloseTo(old.position.z, 10);
      const sampled = sampleReturn(ball.plan, ball.from, at);
      for (const axis of ['x','y','z'] as const) expect(sampled[axis]).toBeCloseTo(ball.position[axis],10);
      expect(ball.plan.arriveAt).toBeLessThan(old.plan.arriveAt);
      expect(ball.plan.arriveAt - ball.plan.departAt).toBeCloseTo((old.plan.arriveAt - old.plan.departAt) * speedMultiplier(score) / speedMultiplier(score + 1), 10);
    }
  });
  it('自分から相手への返球地点も左右へランダムに散る', () => {
    const targets: number[] = [];
    for (let seed = 1; seed <= 40; seed++) {
      const s = scenario(1); s.state.randomState = seed * 7919;
      s.state.balls = [incoming(1, 20.002)]; s.step();
      targets.push(s.state.balls[0]!.plan.target.x);
    }
    expect(Math.min(...targets)).toBeLessThan(-0.35);
    expect(Math.max(...targets)).toBeGreaterThan(0.35);
    expect(new Set(targets).size).toBeGreaterThan(20);
  });
});

describe('450からは全てスマッシュ', () => {
  it('確率や直前のスマッシュで通常返球へ戻らない', () => {
    expect(chooseReturnKind(449, 10, [], 0)).toBe('normal');
    for (const random of [0, 0.2, 0.99]) expect(chooseReturnKind(450, 10, [9.9, 10.1], random)).toBe('smash');
  });
  it('450を跨いだ後の通常待機球と追加球もスマッシュになり、予告を省略しない', () => {
    const s = scenario(449);
    const queued = incoming(2, 21.005, INITIAL_PADDLE, 20, 1);
    s.state.balls = [incoming(1, 20.001), { ...queued, phase: 'queued' }];
    const result = s.step(); expect(result.snapshot.score).toBe(450);
    expect(result.events.filter(e => e.kind === 'opponent-hit' && e.ballId === 2)).toEqual([]);
    for (const ball of s.state.balls.filter(b => b.phase === 'queued' || b.phase === 'waiting-return')) {
      expect(ball.plan.smash).toBe(true);
      expect(ball.plan.warningAt).not.toBeNull();
      expect(ball.plan.departAt - ball.plan.warningAt!).toBeCloseTo(0.4, 10);
    }
  });
  it('540ではさらに短い飛行時間になり、予告0.4秒は維持する', () => {
    const request = { ballId: 1, earliestDepartAt: 20, preferredTarget: INITIAL_PADDLE, speedMultiplier: 2.5, score: 539, randomValue: 0 };
    const before = planOpponentReturn(request, [], [], DEFAULT_CONFIG);
    const after = planOpponentReturn({ ...request, score: 540 }, [], [], DEFAULT_CONFIG);
    expect(after.arriveAt - after.departAt).toBeLessThan(before.arriveAt - before.departAt);
    expect(after.departAt - after.warningAt!).toBeCloseTo(0.4, 10);
  });
});
