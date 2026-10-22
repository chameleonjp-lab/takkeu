// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createControls } from '../../src/app/controls';
import { createLoop } from '../../src/app/loop';
import { DEFAULT_CONFIG, INITIAL_PADDLE } from '../../src/game/config';
import { createSession } from '../../src/game/session';
import { createInputTimeline } from '../../src/input/timeline';

function replayPointers(hz: number, recontact = false) {
  const element = document.createElement('div'); document.body.append(element);
  const session = createSession(DEFAULT_CONFIG, 7); session.start();
  const timeline = createInputTimeline(INITIAL_PADDLE);
  const loop = createLoop({ session, timeline, config: DEFAULT_CONFIG, onEvents() {}, onPause() {} });
  loop.resetClock(0);
  const controller = createControls(element, { session, timeline, loop, config: DEFAULT_CONFIG, mapping: { screen: { left: 0, top: 0, width: 200, height: 100 }, world: { minX: -1.05, maxX: 1.05, minY: 0.15, maxY: 0.85 } }, onInterruption() {} });
  let releasePosition = 0;
  const positions: number[] = [];
  const pointer = (type: string, x: number, time: number): void => {
    const event = new MouseEvent(type, { clientX: x, clientY: 0, button: 0, bubbles: true, cancelable: true });
    Object.defineProperties(event, { pointerId: { value: 1 }, timeStamp: { value: time } });
    element.dispatchEvent(event);
    if (type === 'pointerup') releasePosition = session.snapshot().paddle.x;
  };
  const actions = [
    { at: 0, run: () => pointer('pointerdown', 0, 0) },
    { at: 1, run: () => pointer('pointermove', 100, 1) },
    { at: 20, run: () => pointer('pointerup', 100, 20) },
  ];
  if (recontact) actions.push({ at: 21, run: () => pointer('pointerdown', 100, 21) }, { at: 22, run: () => pointer('pointermove', 110, 22) });
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
  it('離した時刻まで計算して実位置を確定し、その後に未処理目標へ動き戻らない', () => {
    for (const hz of [30, 60, 120]) {
      const result = replayPointers(hz);
      expect(result.releasePosition).toBeCloseTo(0.05);
      expect(result.finalPosition).toBeCloseTo(result.releasePosition);
      for (const position of result.positions) expect(position).toBeCloseTo(result.releasePosition);
    }
  });
  it('再接触の基準位置も30/60/120Hzで一致し、指位置へ瞬間移動しない', () => {
    for (const hz of [30, 60, 120]) expect(replayPointers(hz, true).finalPosition).toBeCloseTo(0.155);
  });
});
