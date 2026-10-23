// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { createControls } from '../../src/app/controls';
import { createLoop } from '../../src/app/loop';
import { DEFAULT_CONFIG as config } from '../../src/game/config';
import { stepSimulation } from '../../src/game/simulation';
import { createInputTimeline } from '../../src/input/timeline';
import { projectBall } from '../../src/game/viewpoint';
import { sampleReturn } from '../../src/game/trajectory';
import { incoming, scenario } from '../helpers/scenarios';
import type { GameEvent, GameSession } from '../../src/game/types';

it.each([false, true])('未確定の固定境界にあるdownをbounce後・重なり評価前に適用する（配置先で重なる:%s）', overlap => {
  const at = 1.44, s = scenario(0, at - config.fixedDt);
  const ball = incoming(1, 2, { x: 0, y: .5 }, s.state.simTime, 2); s.state.balls = [ball];
  const bounce = projectBall(sampleReturn(ball.plan, ball.from, at), config), away = { x: .7, y: .85 };
  s.state.paddle = overlap ? away : bounce;
  const target = overlap ? bounce : away, events: GameEvent[] = [];
  const session: GameSession = { snapshot: s.snapshot, start() {}, reset() {}, resume() {}, pause() {}, step: (dt, input) => stepSimulation(s.state, config, dt, input) };
  const timeline = createInputTimeline(s.state.paddle);
  const loop = createLoop({ session, timeline, config, onEvents: next => events.push(...next), onPause() {} }); loop.resetClock(0);
  const element = document.createElement('canvas'); document.body.append(element);
  const controls = createControls(element, { session, timeline, loop, config,
    mapping: { screen: { left: 0, top: 0, width: 100, height: 100 }, toWorld: () => target }, onInterruption() {} });
  const event = new MouseEvent('pointerdown', { clientX: 50, clientY: 50, button: 0, buttons: 1, bubbles: true });
  Object.defineProperties(event, { pointerId: { value: 1 }, timeStamp: { value: config.fixedDt * 1000 } }); element.dispatchEvent(event);
  expect(events).toEqual([]); // The handler must not commit this endpoint itself.
  loop.frame(config.fixedDt * 1000);
  expect(events.map(e => e.kind)).toEqual(overlap ? ['table-bounce', 'player-hit'] : ['table-bounce']);
  expect(s.state.score).toBe(Number(overlap));
  expect(s.state.paddle.x).toBeCloseTo(target.x, 12); expect(s.state.paddle.y).toBeCloseTo(target.y, 12);
  controls.dispose(); element.remove();
});
