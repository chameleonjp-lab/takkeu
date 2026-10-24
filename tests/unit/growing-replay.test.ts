import { expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/game/config';
import { scheduleReturn } from '../../src/game/scheduler';
import { scenario } from '../helpers/scenarios';
import type { GameEvent, GameSnapshot, PaddlePoint } from '../../src/game/types';

function make() {
  const s = scenario(450);
  for (let id = 1; id <= 47; id++) {
    const plan = scheduleReturn({ ballId: id, earliestDepartAt: 20, preferredTarget: { x: id % 2 ? -0.7 : 0.7, y: 0.5 }, speedMultiplier: 2.6, score:450, smash: true }, s.snapshot().scheduledReturns, DEFAULT_CONFIG);
    const from = { x: 0, y: 0.5, z: -DEFAULT_CONFIG.paddleZ };
    s.state.balls.push({ id, phase: 'queued', position: from, from, plan, warningSent: false });
  }
  return s;
}
const comparable = ({ runId: _, ...snapshot }: GameSnapshot) => snapshot;
const eventData = (events: GameEvent[]) => events.map(({ id: _, runId: __, ...event }) => event);

it('47球から増球・加速・スマッシュを含む同じ入力で30/60/120Hzの結果が一致する', () => {
  const baseline = make(), input: PaddlePoint[] = [], expected: GameEvent[] = [];
  for (let tick = 0; tick < 120 * 30; tick++) {
    const target = baseline.snapshot().scheduledReturns[0]?.target ?? baseline.state.paddle;
    input.push(target); expected.push(...baseline.step(target).events);
  }
  expect(baseline.state.score).toBeGreaterThan(500);
  expect(baseline.state.balls.length).toBeGreaterThan(47);
  for (const hz of [30, 60, 120]) {
    const s = make(), events: GameEvent[] = [];
    let ticks = 0;
    for (let frame = 1; frame <= hz * 30; frame++) {
      while ((ticks + 1) * DEFAULT_CONFIG.fixedDt <= frame / hz + 1e-10) events.push(...s.step(input[ticks++]!).events);
    }
    expect(comparable(s.snapshot())).toEqual(comparable(baseline.snapshot()));
    expect(eventData(events)).toEqual(eventData(expected));
    expect(s.state.randomState).toBe(baseline.state.randomState);
  }
// The new late-game cadence adds three balls per hit. Keep all four complete
// 30-second replays; this is deterministic correctness, not a wall-clock benchmark.
}, 20_000);
