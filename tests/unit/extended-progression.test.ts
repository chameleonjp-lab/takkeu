import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, INITIAL_PADDLE } from '../../src/game/config';
import { ballCountAtScore, ballRewardScore, earnedBallCountAtScore, MILESTONES } from '../../src/game/milestones';
import { advanceProgression } from '../../src/game/progression';
import { bounceTime, sampleReturn } from '../../src/game/trajectory';
import { incoming, scenario } from '../helpers/scenarios';

describe('470以後も3ラリー1球の報酬と所持上限を継続', () => {
  it.each([[469,139],[470,139],[471,140],[472,140],[480,143],[490,146],[500,149],[510,153],[520,156],[530,159],[540,163],[555,168]])('%iでは累計%i球を獲得し所持は30球まで', (score, count) => {
    expect(earnedBallCountAtScore(score)).toBe(count);
    expect(ballCountAtScore(score)).toBe(30);
    expect(scenario(score).state.progression.awardedBallCount).toBe(count - 1);
  });
  it('470を跨ぐ複数加点と再評価で二重追加しない', () => {
    const s = scenario(469); s.state.balls = [1,2,3,4].map(id => incoming(id, 20.001));
    const result = s.step(); expect(result.snapshot.score).toBe(473); expect(result.snapshot.balls).toHaveLength(5);
    expect(result.events.filter(e => e.kind === 'milestone').map(e => e.milestone)).toEqual([470,471]);
    expect(s.step().snapshot.balls).toHaveLength(5);
    expect(ballRewardScore(139)).toBe(471); expect(ballRewardScore(140)).toBe(474);
    expect(MILESTONES).toContain(555);
  });
  it('落球は補充せず飛び越した報酬だけを数える', () => {
    const s = scenario(469); const update = advanceProgression(s.state.progression, 469, 480, 20);
    expect(update.addedBalls).toBe(4);
    expect(update.state.awardedBallCount).toBe(142);
    expect(advanceProgression(update.state, 480, 480, 20).addedBalls).toBe(0);
    expect(advanceProgression(update.state, 480, 481, 20).addedBalls).toBe(0);
    expect(advanceProgression(update.state, 481, 482, 20).addedBalls).toBe(0);
    expect(advanceProgression(update.state, 482, 483, 20).addedBalls).toBe(1);
  });
});

describe('位置と時刻を持つ花火イベント', () => {
  it('520に到達する返球から、当たった時点のラケット中心で一度だけ出す', () => {
    const s = scenario(518); s.state.balls = [incoming(1,20.001),incoming(2,20.003)];
    const hits = s.step().events.filter(e => e.kind === 'player-hit');
    expect(hits.map(e => e.effect)).toEqual([undefined, 'racket-firework']);
    expect(hits[1]!.position).toEqual({ ...INITIAL_PADDLE, z: DEFAULT_CONFIG.paddleZ });
    expect(s.step().events.filter(e => e.effect === 'racket-firework')).toHaveLength(0);
  });
  it('530から自コートの台面バウンドを一度だけ出し、停止時には進めない', () => {
    const s = scenario(530); const ball = incoming(1,20.282, INITIAL_PADDLE,20,1);
    s.state.balls = [ball]; const events = s.step().events.filter(e => e.kind === 'table-bounce');
    expect(events).toHaveLength(1); expect(events[0]!.effect).toBe('bounce-firework');
    expect(events[0]!.position!.y).toBeCloseTo(DEFAULT_CONFIG.tableY + DEFAULT_CONFIG.ballRadius,10);
    expect(events[0]!.position!.z).toBeGreaterThan(0);
    s.state.phase = 'paused'; const paused = s.snapshot();
    expect(s.step().events).toEqual([]); expect(s.snapshot()).toEqual(paused);
    s.state.phase = 'running'; expect(s.step().events.filter(e => e.kind === 'table-bounce')).toHaveLength(0);
  });
});

describe('555から曲がるバウンド', () => {
  it('新しい返球はバウンドで横方向を変え、位置は連続し台上に落ちる', () => {
    const s = scenario(555); s.state.balls = [incoming(1,20.001)]; s.step();
    const ball = s.state.balls[0]!, at = bounceTime(ball.plan), epsilon = 1e-6;
    expect(ball.plan.bounceX).toBeDefined();
    const before = sampleReturn(ball.plan,ball.from,at-epsilon), bounce = sampleReturn(ball.plan,ball.from,at), after = sampleReturn(ball.plan,ball.from,at+epsilon);
    expect((bounce.x-before.x)*(after.x-bounce.x)).toBeLessThan(0);
    expect(Math.abs(after.x-before.x)).toBeLessThan(0.0001);
    expect(Math.abs(bounce.x)).toBeLessThan(DEFAULT_CONFIG.tableHalfWidth-DEFAULT_CONFIG.ballRadius);
    expect(bounce.y).toBeCloseTo(DEFAULT_CONFIG.ballRadius,10);
    expect(sampleReturn(ball.plan,ball.from,ball.plan.arriveAt).x).toBeCloseTo(ball.plan.target.x,10);
  });
});
