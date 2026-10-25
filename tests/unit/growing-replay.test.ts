import { expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/game/config';
import { scheduleReturn } from '../../src/game/scheduler';
import { scenario } from '../helpers/scenarios';
import type { GameEvent, GameSnapshot, PaddlePoint } from '../../src/game/types';

function make() {
  const s = scenario(450);
  for (let id = 1; id <= 30; id++) {
    const plan = scheduleReturn({ ballId: id, earliestDepartAt: 20, preferredTarget: { x: id % 2 ? -0.7 : 0.7, y: 0.5 }, speedMultiplier: 2.6, score:450, smash: true }, s.snapshot().scheduledReturns, DEFAULT_CONFIG);
    const from = { x: 0, y: 0.5, z: -DEFAULT_CONFIG.paddleZ };
    s.state.balls.push({ id, phase: 'queued', position: from, from, plan, warningSent: false });
  }
  s.state.nextBallId = 31;
  return s;
}
const comparable = ({ runId: _, ...snapshot }: GameSnapshot) => snapshot;
const eventData = (events: GameEvent[]) => events.map(({ id: _, runId: __, ...event }) => event);

it('30球から同時返球・失球・増球・スマッシュを含む30秒の入力が30/60/120Hzで一致する', () => {
  const baseline = make(), input: PaddlePoint[] = [], expected: GameEvent[] = [];
  const seen = new Set(baseline.state.balls.map(ball => ball.id));
  let losses = 0, additions = 0, peakFlying = 0;
  const initialDepartures = new Map<number, number>();
  for (let tick = 0; tick < 120 * 30; tick++) {
    // A deliberate opening hold catches one wing and lets the other wing fall.
    const target = tick < 240 ? { x: -0.7, y: 0.5 } : baseline.snapshot().scheduledReturns[0]?.target ?? baseline.state.paddle;
    input.push(target);
    const result = baseline.step(target); expected.push(...result.events);
    losses += result.events.filter(event => event.kind === 'ball-lost').length;
    for (const event of result.events) {
      if (event.kind === 'opponent-hit' && event.ballId! <= 30 && !initialDepartures.has(event.ballId!)) initialDepartures.set(event.ballId!, event.time);
    }
    for (const ball of result.snapshot.balls) if (!seen.has(ball.id)) { seen.add(ball.id); additions++; }
    peakFlying = Math.max(peakFlying, result.snapshot.balls.filter(ball => ball.phase === 'incoming' || ball.phase === 'outgoing').length);
    expect(result.snapshot.phase).toBe('running');
    expect(result.snapshot.balls).toHaveLength(30 + additions - losses);
    expect(result.snapshot.balls.length).toBeLessThanOrEqual(30);
  }
  expect(initialDepartures.size).toBe(30);
  expect(new Set(initialDepartures.values()).size).toBe(1);
  expect(peakFlying).toBe(30);
  expect(baseline.state.score).toBeGreaterThan(500);
  expect(baseline.state.simTime).toBeCloseTo(50, 8);
  expect(expected.filter(event => event.kind === 'player-hit')).toHaveLength(baseline.state.score - 450);
  expect(expected.some(event => event.kind === 'smash-warning')).toBe(true);
  expect(losses).toBeGreaterThan(0);
  expect(additions).toBeGreaterThan(0);
  for (const hz of [30, 60, 120]) {
    const s = make(), events: GameEvent[] = [];
    let ticks = 0;
    for (let frame = 1; frame <= hz * 30; frame++) {
      while ((ticks + 1) * DEFAULT_CONFIG.fixedDt <= frame / hz + 1e-10) {
        const result = s.step(input[ticks++]!); events.push(...result.events);
        expect(result.snapshot.balls.length).toBeLessThanOrEqual(30);
      }
    }
    expect(ticks).toBe(120 * 30);
    expect(comparable(s.snapshot())).toEqual(comparable(baseline.snapshot()));
    expect(eventData(events)).toEqual(eventData(expected));
    expect(s.state.randomState).toBe(baseline.state.randomState);
  }
}, 20_000);
