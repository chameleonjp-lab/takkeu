import { expect, it } from 'vitest';
import { DEFAULT_CONFIG as config, INITIAL_PADDLE } from '../../src/game/config';
import { sweepPaddleHit } from '../../src/game/collision';
import { scheduleReturn } from '../../src/game/scheduler';
import { chooseOpponentTarget, choosePlayerTarget } from '../../src/game/targets';
import { bounceTime, sampleReturn } from '../../src/game/trajectory';
import { clampPaddle } from '../../src/game/config';

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
