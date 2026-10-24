import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, INITIAL_PADDLE } from '../../src/game/config';
import { MILESTONES } from '../../src/game/milestones';
import { scheduleReturn } from '../../src/game/scheduler';
import { incoming, scenario } from '../helpers/scenarios';

describe('多球の接触・落球・累計到達', () => {
  it.each([[4, 5], [9, 10], [19, 20], [29, 30], [39, 40], [148, 150]])('%iから同時接触で閾値%iを飛び越しても追加は1球', (score, milestone) => {
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
  it('上限速度の4球でも同時の取り逃しを実際の失球として数えながら継続できる', () => {
    const s = scenario(10000);
    for (let id = 1; id <= 4; id++) {
      const plan = scheduleReturn({ ballId: id, earliestDepartAt: 20, preferredTarget: { x: id % 2 ? -1.05 : 1.05, y: id % 2 ? 0.15 : 0.85 }, speedMultiplier: 2.6, score:s.state.score, smash: true }, s.snapshot().scheduledReturns, DEFAULT_CONFIG);
      const from = { x: 0, y: 0.5, z: -DEFAULT_CONFIG.paddleZ };
      s.state.balls.push({ id, phase: 'queued', position: from, from, plan, warningSent: false });
    }
    s.state.nextBallId = 5;
    let warnings = 0, losses = 0, additions = 0;
    const seen = new Set(s.state.balls.map(ball => ball.id));
    for (let tick = 0; tick < 120 * 30; tick++) {
      const next = s.snapshot().scheduledReturns[0];
      // Hold one wing through the first wave so opposite-wing balls really miss.
      const result = s.step(tick < 240 ? { x: -1.05, y: 0.15 } : next?.target ?? s.state.paddle);
      warnings += result.events.filter(e => e.kind === 'smash-warning').length;
      losses += result.events.filter(e => e.kind === 'ball-lost').length;
      for (const ball of result.snapshot.balls) if (!seen.has(ball.id)) { seen.add(ball.id); additions++; }
      expect(result.snapshot.balls).toHaveLength(4 + additions - losses);
      expect(result.snapshot.balls.length).toBeLessThanOrEqual(30);
      expect(result.snapshot.phase).toBe('running');
    }
    expect(s.state.score).toBeGreaterThan(10010);
    expect(s.state.simTime).toBeCloseTo(50, 8);
    expect(warnings).toBeGreaterThan(0);
    expect(losses).toBeGreaterThan(0);
    expect(additions).toBeGreaterThan(0);
  });
  it('落球でも解放を維持し、飛行中の別球も加速する', () => {
    const s = scenario(149);
    const future = incoming(3, 21.5);
    s.state.balls = [incoming(1, 20.004), incoming(2, 19.992, { x: 1, y: 0.5 }, 20, 0.1), future];
    const original = structuredClone(future.plan);
    s.step();
    expect(s.state.score).toBe(150);
    const changed=s.snapshot().scheduledReturns.find(p => p.ballId === 3)!;
    expect(changed.arriveAt).toBeLessThan(original.arriveAt);
    expect(changed.target).toEqual(original.target);
    expect(s.state.progression.appliedMilestones).toContain(150);
  });
});


it('162で4球を超えて増え、落球した球を配列に残さずIDを再利用しない', () => {
  const s = scenario(161);
  s.state.balls = [1, 2, 3, 4].map(id => incoming(id, id === 1 ? 20.005 : 24 + id));
  let result = s.step();
  expect(result.snapshot.score).toBe(162);
  expect(result.snapshot.balls).toHaveLength(5);
  expect(result.events.filter(e => e.kind === 'milestone').map(e => e.milestone)).toEqual([162]);
  const old = s.state.balls.find(b => b.id === 5)!; old.phase = 'lost';
  s.step();
  expect(s.snapshot().balls.some(b => b.id === 5)).toBe(false);
  s.state.score = 170;
  s.state.balls[0] = incoming(1, s.state.simTime + 0.005, INITIAL_PADDLE, s.state.simTime);
  result = s.step();
  expect(result.snapshot.balls.some(b => b.id === 6)).toBe(true);
  expect(result.snapshot.balls.some(b => b.id === 5)).toBe(false);
  expect(result.snapshot.phase).toBe('running');
});


it('450の30球が全て同時に返り、失球と増球を反映して30ゲーム秒継続する', () => {
  const s = scenario(450);
  for (let id = 1; id <= 30; id++) {
    const plan = scheduleReturn({ ballId: id, earliestDepartAt: 20, preferredTarget: { x: id % 2 ? -0.7 : 0.7, y: 0.5 }, speedMultiplier: 2.6, score:s.state.score, smash: true }, s.snapshot().scheduledReturns, DEFAULT_CONFIG);
    const from = { x: 0, y: 0.5, z: -DEFAULT_CONFIG.paddleZ };
    s.state.balls.push({ id, phase: 'queued', position: from, from, plan, warningSent: false });
  }
  s.state.nextBallId = 31;
  let smashes = 0, losses = 0, additions = 0, peakFlying = 0;
  const seen = new Set(s.state.balls.map(ball => ball.id));
  const initialDepartures = new Map<number, number>();
  for (let tick = 0; tick < 120 * 30; tick++) {
    // Catch one half of the opening simultaneous wave, then track later returns.
    const target = tick < 240 ? { x: -0.7, y: 0.5 } : s.snapshot().scheduledReturns[0]?.target ?? s.state.paddle;
    const result = s.step(target);
    smashes += result.events.filter(e => e.kind === 'smash-warning').length;
    losses += result.events.filter(e => e.kind === 'ball-lost').length;
    for (const event of result.events) {
      if (event.kind === 'opponent-hit' && event.ballId! <= 30 && !initialDepartures.has(event.ballId!)) initialDepartures.set(event.ballId!, event.time);
    }
    for (const ball of result.snapshot.balls) if (!seen.has(ball.id)) { seen.add(ball.id); additions++; }
    peakFlying = Math.max(peakFlying, result.snapshot.balls.filter(ball => ball.phase === 'incoming' || ball.phase === 'outgoing').length);
    expect(result.snapshot.phase).toBe('running');
    expect(result.snapshot.balls).toHaveLength(30 + additions - losses);
    expect(result.snapshot.balls.length).toBeLessThanOrEqual(30);
    expect(new Set(result.snapshot.balls.map(ball => ball.id)).size).toBe(result.snapshot.balls.length);
  }
  expect([...initialDepartures.keys()].sort((a, b) => a - b)).toEqual(Array.from({ length: 30 }, (_, index) => index + 1));
  expect(new Set(initialDepartures.values()).size).toBe(1);
  expect(peakFlying).toBe(30);
  expect(s.state.score).toBeGreaterThan(500);
  expect(s.state.simTime).toBeCloseTo(50, 8);
  expect(smashes).toBeGreaterThan(0);
  expect(losses).toBeGreaterThan(0);
  expect(additions).toBeGreaterThan(0);
  expect(s.state.progression.appliedMilestones.length).toBe(MILESTONES.filter(n => n<=s.state.score).length);
}, 20_000);
