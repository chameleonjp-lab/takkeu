import { DEFAULT_CONFIG } from '../../src/game/config';
import { paddleExitFraction } from '../../src/game/collision';
import { sampleReturn } from '../../src/game/trajectory';
import { incoming, scenario } from './scenarios';
import { waitingBall } from './remainingBall';

/** Arrange a real missed trajectory to leave the playable area at the given time. */
export function ballLostAt(id: number, at: number, now: number) {
  const ball = incoming(id, now + 0.1, { x: 0.8, y: 0.6 }, now, 0.2);
  for (let t = now; t < now + 1; t += DEFAULT_CONFIG.fixedDt) {
    const fraction = paddleExitFraction(sampleReturn(ball.plan, ball.from, t), sampleReturn(ball.plan, ball.from, t + DEFAULT_CONFIG.fixedDt), DEFAULT_CONFIG);
    if (fraction === null) continue;
    const shift = at - (t + fraction * DEFAULT_CONFIG.fixedDt);
    ball.plan = { ...ball.plan, departAt: ball.plan.departAt + shift, netCrossAt: ball.plan.netCrossAt + shift, arriveAt: ball.plan.arriveAt + shift };
    ball.position = sampleReturn(ball.plan, ball.from, now);
    return ball;
  }
  throw new Error('Missed trajectory never left the playable area');
}

export function lossLimitScenario(count = 98, score = 340, now = 0) {
  const s = scenario(score, now);
  s.state.lostBallCount = count;
  s.state.balls = [waitingBall(1, score, now + 100), ballLostAt(2, now + 0.02, now), ballLostAt(3, now + 0.06, now)];
  s.state.nextBallId = 4;
  return s;
}
