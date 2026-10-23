import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, INITIAL_PADDLE } from '../../src/game/config';
import { ballCountAtScore } from '../../src/game/milestones';
import { scheduleReturn } from '../../src/game/scheduler';
import { incoming, scenario } from '../helpers/scenarios';

describe('多球の接触・落球・累計到達', () => {
  it.each([[4, 5], [9, 10], [19, 20], [29, 30], [39, 40], [149, 150]])('%iから同時接触で閾値%iを飛び越しても追加は1球', (score, milestone) => {
    const s = scenario(score);
    s.state.balls = [incoming(1, 20.005), incoming(2, 20.005)];
    const result = s.step();
    expect(result.snapshot.score).toBe(score + 2);
    expect(result.snapshot.balls).toHaveLength(3);
    expect(['queued', 'incoming']).toContain(result.snapshot.balls[2]!.phase);
    expect(result.events.filter(e => e.kind === 'player-hit')).toHaveLength(2);
    expect(result.events.filter(e => e.kind === 'milestone' && e.milestone === milestone)).toHaveLength(1);
    const added = result.snapshot.scheduledReturns.find(p => p.ballId === 3)!;
    expect(added.arriveAt).toBeGreaterThanOrEqual(21);
    for (let i = 0; i < 10; i++) s.step();
    expect(s.snapshot().balls).toHaveLength(3);
  });
  it('途中の落球を補充せず、40では残り1球から2球になる', () => {
    const s = scenario(39);
    const lost = incoming(1, 19);
    s.state.balls = [{ ...lost, phase: 'lost' }, incoming(2, 20.005)];
    s.step();
    expect(s.snapshot().balls.filter(b => b.phase !== 'lost')).toHaveLength(2);
    expect(s.snapshot().progression.appliedMilestones).toContain(40);
  });
  it('接触と落球を時刻・球ID順に処理し、追加の待機球があれば終了しない', () => {
    const s = scenario(29);
    // The miss fixture crosses the visible lower boundary during this step.
    s.state.balls = [incoming(2, 20.004), incoming(1, 19.992, { x: 1, y: 0.5 }, 20, 0.1)];
    const { events, snapshot } = s.step();
    expect(events.filter(e => e.kind !== 'opponent-hit').map(e => e.kind)).toEqual(['player-hit', 'milestone', 'ball-lost']);
    expect(events.map(e => e.time)).toEqual(events.map(e => e.time).sort((a, b) => a - b));
    expect(snapshot.phase).toBe('running');
    expect(snapshot.balls.filter(b => b.phase !== 'lost')).toHaveLength(2);
    expect(snapshot.score).toBe(30);
  });
  it('最後の球を失えば終了を一度だけ発行し、将来の報酬は追加しない', () => {
    const s = scenario(29);
    s.state.balls = [incoming(1, 19.992, { x: 1, y: 0.5 }, 20, 0.1)];
    const result = s.step();
    expect(result.events.map(e => e.kind)).toEqual(['ball-lost', 'game-over']);
    expect(s.snapshot().balls.filter(b => b.phase !== 'lost')).toHaveLength(0);
    expect(s.step().events).toEqual([]);
    expect(s.snapshot().score).toBe(29);
  });
  it('高速な4球と移動中のラケットでも全接触を個別に数え、再接触をロックする', () => {
    const s = scenario(390);
    s.state.paddle = { x: -0.025, y: 0.5 };
    s.state.balls = [4, 2, 3, 1].map(id => incoming(id, 20.001, INITIAL_PADDLE, 20, 0.02));
    const { events } = s.step({ x: 1, y: 0.5 });
    expect(events.filter(e => e.kind === 'player-hit').map(e => e.ballId)).toEqual([1, 2, 3, 4]);
    expect(s.snapshot().score).toBe(394);
    expect(s.step().events.filter(e => e.kind === 'player-hit')).toHaveLength(0);
    expect(s.snapshot().progression.appliedMilestones).toContain(390);
  });
  it('4球・上限速度でも決められた中心へ順に移動すれば継続できる', () => {
    const s = scenario(10000);
    for (let id = 1; id <= 4; id++) {
      const plan = scheduleReturn({ ballId: id, earliestDepartAt: 20, preferredTarget: { x: id % 2 ? -1.05 : 1.05, y: id % 2 ? 0.15 : 0.85 }, speedMultiplier: 2.2, smash: false }, s.snapshot().scheduledReturns, DEFAULT_CONFIG);
      const from = { x: 0, y: 0.5, z: -DEFAULT_CONFIG.paddleZ };
      s.state.balls.push({ id, phase: 'queued', position: from, from, plan, warningSent: false });
    }
    let warnings = 0;
    for (let tick = 0; tick < 120 * 30; tick++) {
      const next = s.snapshot().scheduledReturns[0];
      warnings += s.step(next?.target ?? s.state.paddle).events.filter(e => e.kind === 'smash-warning').length;
      expect(s.state.balls.filter(b => b.phase !== 'lost')).toHaveLength(4 + Math.floor((s.state.score - 10000) / 10));
    }
    expect(s.state.score).toBeGreaterThan(10030);
    expect(warnings).toBeGreaterThan(0);
  });
  it('落球でも解放・加速を維持し、確定済み予約は閾値通過でも変わらない', () => {
    const s = scenario(149);
    const future = incoming(3, 21.5);
    s.state.balls = [incoming(1, 20.004), incoming(2, 19.992, { x: 1, y: 0.5 }, 20, 0.1), future];
    const original = structuredClone(future.plan);
    s.step();
    expect(s.state.score).toBe(150);
    expect(s.snapshot().scheduledReturns.find(p => p.ballId === 3)).toEqual(original);
    expect(s.state.progression.appliedMilestones).toContain(150);
  });
});


it('160で4球を超えて増え、落球した球を配列に残さずIDを再利用しない', () => {
  const s = scenario(159);
  s.state.balls = [1, 2, 3, 4].map(id => incoming(id, id === 1 ? 20.005 : 24 + id));
  let result = s.step();
  expect(result.snapshot.score).toBe(160);
  expect(result.snapshot.balls).toHaveLength(5);
  expect(result.events.filter(e => e.kind === 'milestone').map(e => e.milestone)).toEqual([160]);
  const old = s.state.balls.find(b => b.id === 5)!; old.phase = 'lost';
  s.step();
  expect(s.snapshot().balls.some(b => b.id === 5)).toBe(false);
  s.state.score = 169;
  s.state.balls[0] = incoming(1, s.state.simTime + 0.005, INITIAL_PADDLE, s.state.simTime);
  result = s.step();
  expect(result.snapshot.balls.some(b => b.id === 6)).toBe(true);
  expect(result.snapshot.balls.some(b => b.id === 5)).toBe(false);
  expect(result.snapshot.phase).toBe('running');
});


it('450の無落球47球を30ゲーム秒継続し、追加・スマッシュ・到着余裕を守る', () => {
  const s = scenario(450);
  for (let id = 1; id <= 47; id++) {
    const plan = scheduleReturn({ ballId: id, earliestDepartAt: 20, preferredTarget: { x: id % 2 ? -0.7 : 0.7, y: 0.5 }, speedMultiplier: 2.2, smash: false }, s.snapshot().scheduledReturns, DEFAULT_CONFIG);
    const from = { x: 0, y: 0.5, z: -DEFAULT_CONFIG.paddleZ };
    s.state.balls.push({ id, phase: 'queued', position: from, from, plan, warningSent: false });
  }
  let smashes = 0;
  for (let tick = 0; tick < 120 * 30; tick++) {
    const result = s.step(s.snapshot().scheduledReturns[0]?.target ?? s.state.paddle);
    smashes += result.events.filter(e => e.kind === 'smash-warning').length;
    expect(result.snapshot.phase).toBe('running');
    expect(result.snapshot.balls).toHaveLength(ballCountAtScore(result.snapshot.score));
    if (tick % 120 === 0) {
      const plans = result.snapshot.scheduledReturns;
      for (let i = 1; i < plans.length; i++) {
        const a = plans[i - 1]!, b = plans[i]!;
        expect(b.arriveAt - a.arriveAt + 1e-10).toBeGreaterThanOrEqual(0.12 + Math.hypot(a.target.x - b.target.x, a.target.y - b.target.y) / 6);
      }
    }
  }
  expect(s.state.score).toBeGreaterThan(500);
  expect(smashes).toBeGreaterThan(0);
  expect(s.state.progression.appliedMilestones.length).toBe(20);
});
