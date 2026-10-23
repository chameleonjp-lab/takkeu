// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createControls } from '../../src/app/controls';
import { createLoop } from '../../src/app/loop';
import { clampPaddle, DEFAULT_CONFIG, INITIAL_PADDLE } from '../../src/game/config';
import { createSession } from '../../src/game/session';
import { createInputTimeline } from '../../src/input/timeline';

function replayPointers(hz: number, recontact = false) {
  const element = document.createElement('div'); document.body.append(element);
  const session = createSession(DEFAULT_CONFIG, 7); session.start();
  const timeline = createInputTimeline(INITIAL_PADDLE);
  const loop = createLoop({ session, timeline, config: DEFAULT_CONFIG, onEvents() {}, onPause() {} });
  loop.resetClock(0);
  const controller = createControls(element, { session, timeline, loop, config: DEFAULT_CONFIG, mapping: { screen: { left: 0, top: 0, width: 200, height: 100 }, toWorld: (x: number) => clampPaddle({ x: (x - 100) / 100, y: .5 }, DEFAULT_CONFIG) }, onInterruption() {} });
  let releasePosition = 0;
  const positions: number[] = [];
  const pointer = (type: string, x: number, time: number): void => {
    const event = new MouseEvent(type, { clientX: x, clientY: 0, button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true });
    Object.defineProperties(event, { pointerId: { value: 1 }, timeStamp: { value: time } });
    element.dispatchEvent(event);
    if (type === 'pointerup') releasePosition = session.snapshot().paddle.x;
  };
  const actions = [
    { at: 0, run: () => pointer('pointerdown', 40, 0) },
    { at: 1, run: () => pointer('pointermove', 170, 1) },
    { at: 20, run: () => pointer('pointerup', 170, 20) },
  ];
  if (recontact) actions.push({ at: 21, run: () => pointer('pointerdown', 120, 21) }, { at: 22, run: () => pointer('pointermove', 150, 22) });
  for (let i = 1; i <= hz / 10; i++) {
    const at = i * 1000 / hz;
    actions.push({ at, run() { loop.frame(at); if (at > 20) positions.push(session.snapshot().paddle.x); } });
  }
  actions.sort((a, b) => a.at - b.at).forEach(action => action.run());
  const finalPosition = session.snapshot().paddle.x;
  controller.dispose(); element.remove();
  return { releasePosition, finalPosition, positions };
}

describe('生のポインター入力を実際のアプリ接続へ渡す回帰検査', () => {
  it('離すまで受理した直接移動を確定し、その後に古い位置へ戻らない', () => {
    for (const hz of [30, 60, 120]) {
      const result = replayPointers(hz);
      expect(result.releasePosition).toBeCloseTo(0.7);
      expect(result.finalPosition).toBeCloseTo(result.releasePosition);
      for (const position of result.positions) expect(position).toBeCloseTo(result.releasePosition);
    }
  });
  it('再接触の直接配置と移動も30/60/120Hzで一致する', () => {
    for (const hz of [30, 60, 120]) expect(replayPointers(hz, true).finalPosition).toBeCloseTo(0.5);
  });
});

it('2000Hz相当の生pointer列とreleaseを含めても描画周期30/60/120Hzだけでは接触・時刻・得点が変わらない', () => {
  function run(hz: number) {
    const element = document.createElement('canvas'); document.body.append(element);
    const session = createSession(DEFAULT_CONFIG, 7); session.start();
    const timeline = createInputTimeline(INITIAL_PADDLE);
    const events: { kind: string; time: number; ballId?: number }[] = [];
    const loop = createLoop({ session, timeline, config: DEFAULT_CONFIG, onEvents(e) { events.push(...e); }, onPause() {} });
    loop.resetClock(0);
    const controller = createControls(element, { session, timeline, loop, config: DEFAULT_CONFIG,
      mapping: { screen: { left: 0, top: 0, width: 200, height: 100 }, toWorld: x => clampPaddle({ x: (x - 100) / 100, y: .5 }, DEFAULT_CONFIG) }, onInterruption() {} });
    const actions: { at: number; run(): void }[] = [];
    function input(type: string, at: number, x: number) {
      actions.push({ at, run() {
        const event = new MouseEvent(type, { clientX: x, clientY: 50, buttons: type === 'pointerup' ? 0 : 1, button: 0, bubbles: true });
        Object.defineProperties(event, { pointerId: { value: 1 }, timeStamp: { value: at } }); element.dispatchEvent(event);
      } });
    }
    input('pointerdown', .5, 100); input('pointerup', 1.5, 100);
    input('pointerdown', 3000.5, 40);
    for (let n = 1; n <= 16; n++) input('pointermove', 3000.5 + n * .5, n % 2 ? 170 : 40);
    input('pointerup', 3009.5, 40);
    input('pointerdown', 4700.5, 50); input('pointerup', 4701.5, 50);
    for (let n = 1; n <= hz * 6; n++) actions.push({ at: n * 1000 / hz, run() { loop.frame(n * 1000 / hz); } });
    actions.sort((a, b) => a.at - b.at).forEach(a => a.run());
    const { runId: _, ...state } = session.snapshot();
    controller.dispose(); element.remove();
    return { state, events: events.map(e => ({ kind: e.kind, time: e.time, ballId: e.ballId })) };
  }
  const baseline = run(120);
  expect(baseline.events.filter(e => e.kind === 'player-hit').length).toBeGreaterThanOrEqual(1);
  expect(run(30)).toEqual(baseline); expect(run(60)).toEqual(baseline);
});

it('1刻み未満で離した入力を捨てず、次の固定境界で最後の受理位置を確定する', () => {
  const element = document.createElement('canvas'); document.body.append(element);
  const session = createSession(DEFAULT_CONFIG, 7); session.start();
  const timeline = createInputTimeline(INITIAL_PADDLE);
  const loop = createLoop({ session, timeline, config: DEFAULT_CONFIG, onEvents() {}, onPause() {} }); loop.resetClock(0);
  const controller = createControls(element, { session, timeline, loop, config: DEFAULT_CONFIG,
    mapping: { screen: { left: 0, top: 0, width: 200, height: 100 }, toWorld: x => ({ x: x / 200, y: .5 }) }, onInterruption() {} });
  for (const [type, at, x] of [['pointerdown', 1, 20], ['pointermove', 2, 100], ['pointerup', 3, 100]] as const) {
    const event = new MouseEvent(type, { clientX: x, clientY: 50, button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true });
    Object.defineProperties(event, { pointerId: { value: 1 }, timeStamp: { value: at } }); element.dispatchEvent(event);
  }
  expect(session.snapshot().paddle).toEqual(INITIAL_PADDLE);
  loop.frame(1000 / 120); expect(session.snapshot().paddle).toEqual({ x: .5, y: .5 });
  loop.frame(1000 / 60); expect(session.snapshot().paddle).toEqual({ x: .5, y: .5 });
  controller.dispose(); element.remove();
});
