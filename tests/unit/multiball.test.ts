import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, INITIAL_PADDLE } from '../../src/game/config';
import { scheduleReturn } from '../../src/game/scheduler';
import { incoming, scenario } from '../helpers/scenarios';

describe('多球の接触・落球・累計到達', () => {
  it.each([[29, 30], [49, 50], [149, 150]])('%iから同時接触で閾値%iを飛び越しても追加は1球', (score, milestone) => {
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
  it('途中の落球を補充せず、50では残り1球から2球になる', () => {
    const s = scenario(49);
    const lost = incoming(1, 19);
    s.state.balls = [{ ...lost, phase: 'lost' }, incoming(2, 20.005)];
    s.step();
    expect(s.snapshot().balls.filter(b => b.phase !== 'lost')).toHaveLength(2);
    expect(s.snapshot().progression.appliedMilestones).toContain(50);
  });
  it('接触と落球を時刻・球ID順に処理し、追加の待機球があれば終了しない', () => {
    const s = scenario(29);
    s.state.balls = [incoming(2, 20.004), incoming(1, 20.005, { x: 1, y: 0.5 }, 20, 0.1)];
    const { events, snapshot } = s.step();
    expect(events.filter(e => e.kind !== 'opponent-hit').map(e => e.kind)).toEqual(['player-hit', 'milestone', 'ball-lost']);
    expect(events.map(e => e.time)).toEqual(events.map(e => e.time).sort((a, b) => a - b));
    expect(snapshot.phase).toBe('running');
    expect(snapshot.balls.filter(b => b.phase !== 'lost')).toHaveLength(2);
    expect(snapshot.score).toBe(30);
  });
  it('最後の球を失えば終了を一度だけ発行し、将来の報酬は追加しない', () => {
    const s = scenario(29);
    s.state.balls = [incoming(1, 20.001, { x: 1, y: 0.5 }, 20, 0.1)];
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
    for (let tick = 0; tick < 120 * 30; tick++) {
      const next = s.snapshot().scheduledReturns[0];
      s.step(next?.target ?? s.state.paddle);
      expect(s.state.balls.filter(b => b.phase !== 'lost')).toHaveLength(4);
    }
    expect(s.state.score).toBeGreaterThan(10030);
  });
  it('落球でも解放・加速を維持し、確定済み予約は閾値通過でも変わらない', () => {
    const s = scenario(149);
    const future = incoming(3, 21.5);
    s.state.balls = [incoming(1, 20.004), incoming(2, 20.002, { x: 1, y: 0.5 }, 20, 0.1), future];
    const original = structuredClone(future.plan);
    s.step();
    expect(s.state.score).toBe(150);
    expect(s.snapshot().scheduledReturns.find(p => p.ballId === 3)).toEqual(original);
    expect(s.state.progression.appliedMilestones).toContain(150);
  });
});
