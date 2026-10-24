import { expect, it } from 'vitest';
import { InstancedMesh } from 'three';
import { DEFAULT_CONFIG } from '../../src/game/config';
import { flightDuration } from '../../src/game/difficulty';
import { sampleReturn } from '../../src/game/trajectory';
import type { BallSnapshot, BallPhase } from '../../src/game/types';
import { createObjects } from '../../src/render/objects';
import { applyPresentation, isBallVisible } from '../../src/render/presentation';
import { incoming, scenario } from '../helpers/scenarios';
import { missPaddle } from '../helpers/remainingBall';

const ball = (phase: BallPhase, x = 0.5, z = -1): BallSnapshot => ({ id: 1, phase, position: { x, y: 0.5, z }, smash: false });

it.each([0, 10, 30, 70, 189, 190, 239, 240, 419, 420, 479, 480, 490, 555])('%iラリーの待機球は100以降に表示し、失球は位置に関係なく隠す', score => {
  const objects = createObjects(DEFAULT_CONFIG), base = scenario(score).snapshot();
  const batches: InstancedMesh[] = [];
  objects.root.traverse(o => { if (o instanceof InstancedMesh) batches.push(o); });
  // Reuse an already-visible visual to catch one-frame residue in every batch.
  for (const phase of ['queued', 'waiting-return', 'lost'] as const) for (const z of [-1.95, -1, 0, 1]) {
    applyPresentation(objects, { ...base, balls: [ball('incoming', 0.5, 1)] });
    expect(batches.some(b => b.count > 0)).toBe(true);
    const snapshot = { ...base, balls: [ball(phase, 0.5, z)] }, before = structuredClone(snapshot);
    const visible = score >= 100 && phase !== 'lost';
    expect(isBallVisible(snapshot.balls[0]!, snapshot)).toBe(visible);
    applyPresentation(objects, snapshot);
    expect(objects.balls.size).toBe(visible ? 1 : 0);
    expect(batches.some(b => b.count > 0 && b.visible)).toBe(visible);
    expect(snapshot).toEqual(before);
  }
  objects.dispose();
});

it.each([
  [30, false, false], [70, false, false], [189, true, true], [190, true, true],
  [239, true, true], [240, true, true], [419, true, true], [420, true, true],
  [479, true, true], [480, true, true], [490, true, true], [555, true, true],
])('相手側の飛行球は100以降に両側とも表示（%i）', (score, right, left) => {
  const base = scenario(score as number).snapshot();
  for (const phase of ['incoming', 'outgoing'] as const) {
    expect(isBallVisible(ball(phase, 0.5), base)).toBe(right);
    expect(isBallVisible(ball(phase, -0.5), base)).toBe(left);
    expect(isBallVisible(ball(phase, 0.5, 0), base)).toBe(true);
  }
});

it.each([70, 190, 240, 490])('相手到達前→到達→待機→打球→自側まで表示と残球を同期する（%i）', score => {
  const s = scenario(score), duration = flightDuration(DEFAULT_CONFIG, score, score >= 450);
  const out = incoming(1, 20.02, { x: 0.5, y: 0.6 });
  out.from = { x: 0.5, y: 0.6, z: 1.95 };
  out.plan = { ...out.plan, landingZ: -1.95 };
  s.state.balls = [{ ...out, phase: 'outgoing', position: sampleReturn(out.plan, out.from, 20) },
    incoming(2, 20.02 + duration, { x: 0.5, y: 0.6 })];
  expect(isBallVisible(s.snapshot().balls[0]!, s.snapshot())).toBe(score >= 100);
  while (s.state.balls[0]!.phase === 'outgoing') s.step(missPaddle);
  expect(s.state.balls[0]!.phase).toBe('waiting-return');
  expect(isBallVisible(s.snapshot().balls[0]!, s.snapshot())).toBe(score >= 100);
  const target = s.state.balls[0]!, waiting = structuredClone(target.position), departAt = target.plan.departAt;
  while (s.state.simTime + DEFAULT_CONFIG.fixedDt < departAt - 1e-10) {
    s.step(missPaddle); expect(target.position).toEqual(waiting);
    expect(isBallVisible(s.snapshot().balls[0]!, s.snapshot())).toBe(score >= 100);
    expect(s.state.balls).toHaveLength(2);
  }
  let departed = false, crossed = false;
  for (let i = 0; i < 500; i++) {
    const result = s.step(missPaddle);
    if (result.events.some(e => e.kind === 'opponent-hit' && e.ballId === 1)) {
      departed = true; expect(target.phase).toBe('incoming');
      const visible = score >= 100;
      expect(isBallVisible(s.snapshot().balls[0]!, s.snapshot())).toBe(visible);
    }
    if (departed && target.position.z >= 0) {
      expect(isBallVisible(s.snapshot().balls[0]!, s.snapshot())).toBe(true); crossed = true; break;
    }
  }
  expect(departed && crossed).toBe(true);
});
