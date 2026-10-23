import { expect, it } from 'vitest';
import { DEFAULT_CONFIG as config, INITIAL_PADDLE } from '../../src/game/config';
import { sweepPaddleHit } from '../../src/game/collision';
import { scheduleReturn } from '../../src/game/scheduler';
import { chooseOpponentTarget, choosePlayerTarget } from '../../src/game/targets';
import { bounceTime, sampleReturn } from '../../src/game/trajectory';
import { clampPaddle } from '../../src/game/config';
import { createSimulationState, stepSimulation } from '../../src/game/simulation';
import { speedMultiplier } from '../../src/game/difficulty';
import { deflectBounce } from '../../src/game/trajectory';

it('実際の返球軌道の75%以上は中央に置いたラケットを外れ、左右の両方へ散る', () => {
  const source = { randomState: 7, lastTargetBand: 1 };
  let caughtAtCentre = 0, left = 0, right = 0;
  const positions = new Set<number>();
  for (let i = 0; i < 3000; i++) {
    const from = { ...chooseOpponentTarget(source, config), z: -config.paddleZ };
    const target = choosePlayerTarget(source, config, from);
    expect(clampPaddle(target, config)).toEqual(target);
    positions.add(target.x);
    if (target.x < -0.3) left++;
    if (target.x > 0.4) right++;
    const plan = scheduleReturn({ ballId: i, earliestDepartAt: 0, preferredTarget: target, speedMultiplier: 1, smash: false }, [], config);
    for (let time = bounceTime(plan); time < plan.arriveAt + 0.35; time += config.fixedDt) {
      if (sweepPaddleHit(sampleReturn(plan, from, time), sampleReturn(plan, from, time + config.fixedDt), INITIAL_PADDLE, INITIAL_PADDLE, config) !== null) {
        caughtAtCentre++; break;
      }
    }
  }
  expect(caughtAtCentre).toBeLessThan(750);
  expect(left).toBeGreaterThan(1050);
  expect(right).toBeGreaterThan(1050);
  expect(positions.size).toBe(3000);
});

it.each([450, 555])('%iの実シミュレーションでも左右の配球を中央固定で拾えない', score => {
  const source = { randomState: 7, lastTargetBand: 1 };
  let caught = 0, wingCatches = 0;
  for (let i = 0; i < 1000; i++) {
    const from = { ...chooseOpponentTarget(source, config), z: -config.paddleZ };
    const target = choosePlayerTarget(source, config, from);
    let plan = scheduleReturn({ ballId: 1, earliestDepartAt: 0, preferredTarget: target, speedMultiplier: speedMultiplier(score), score, smash: true }, [], config);
    if (score >= 555) plan = deflectBounce(plan, from, (i * 7919 % 1000) / 1000, config);
    const state = createSimulationState(7);
    state.phase = 'running'; state.score = score; state.simTime = plan.departAt;
    state.balls = [{ id: 1, phase: 'incoming', position: from, from, plan, warningSent: true }];
    for (let step = 0; step < 200; step++) {
      const result = stepSimulation(state, config, config.fixedDt, { target: INITIAL_PADDLE });
      if (result.events.some(e => e.kind === 'player-hit')) {
        caught++;
        if (target.x < -0.3 || target.x > 0.4) wingCatches++;
        break;
      }
      if (result.events.some(e => e.kind === 'ball-lost')) break;
    }
  }
  expect(wingCatches).toBe(0);
  expect(caught).toBeLessThan(250);
});
