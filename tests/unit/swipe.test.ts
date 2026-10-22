// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createSwipeController } from '../../src/input/swipe';
import type { InputSample } from '../../src/game/types';

function setup() {
  document.body.innerHTML = '<div id="surface"><button>停止</button></div>';
  const element = document.querySelector<HTMLElement>('#surface')!;
  const samples: InputSample[] = [];
  const state = { paddle: { x: 0, y: 0.5 }, interruptions: 0 };
  const controller = createSwipeController(element, {
    mapping: { screen: { left: 0, top: 0, width: 200, height: 100 }, world: { minX: -1.05, maxX: 1.05, minY: 0.15, maxY: 0.85 } },
    onTarget: sample => samples.push(sample), getPaddlePosition: () => state.paddle,
    toSimTime: timestamp => timestamp / 1000, onInterruption: () => state.interruptions++,
  });
  const pointer = (type: string, x: number, y: number, id = 1, target: EventTarget = element) => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
    Object.defineProperty(event, 'pointerId', { value: id });
    target.dispatchEvent(event);
  };
  return { controller, samples, state, pointer, element };
}
afterEach(() => { document.body.innerHTML = ''; });

describe('相対スワイプとマウスドラッグ', () => {
  it('触れた位置に瞬間移動せず、左右上下の移動差分だけを反映する', () => {
    const { pointer, samples, controller } = setup();
    pointer('pointerdown', 180, 90);
    expect(samples.at(-1)?.target).toEqual({ x: 0, y: 0.5 });
    pointer('pointermove', 200, 70);
    expect(samples.at(-1)?.target.x).toBeCloseTo(0.21);
    expect(samples.at(-1)?.target.y).toBeCloseTo(0.64);
    pointer('pointermove', 900, -900);
    expect(samples.at(-1)?.target).toEqual({ x: 1.05, y: 0.85 });
    controller.dispose();
  });
  it('指を離したら未追従の目標を捨て、実位置を保持する', () => {
    const { pointer, samples, state, controller } = setup();
    pointer('pointerdown', 50, 50);
    pointer('pointermove', 180, 0);
    state.paddle = { x: 0.1, y: 0.55 };
    pointer('pointerup', 180, 0);
    expect(samples.at(-1)?.target).toEqual(state.paddle);
    const count = samples.length;
    pointer('lostpointercapture', 180, 0);
    pointer('pointermove', 0, 0);
    expect(samples).toHaveLength(count);
    expect(state.interruptions).toBe(0);
    controller.dispose();
  });
  it('2本目の指とボタン操作を無視し、異常中断だけを通知する', () => {
    const { pointer, samples, state, controller, element } = setup();
    pointer('pointerdown', 0, 0, 1, element.querySelector('button')!);
    expect(samples).toHaveLength(0);
    pointer('pointerdown', 50, 50);
    pointer('pointerdown', 150, 10, 2);
    pointer('pointermove', 180, 10, 2);
    expect(samples.at(-1)?.target).toEqual(state.paddle);
    pointer('pointercancel', 50, 50);
    expect(state.interruptions).toBe(1);
    expect(samples.at(-1)?.target).toEqual(state.paddle);
    controller.dispose();
  });
  it('領域外も追跡し、cancelとdisposeで入力を解除する', () => {
    const { pointer, samples, state, controller } = setup();
    pointer('pointerdown', 50, 50);
    pointer('pointermove', 70, 50, 1, document);
    expect(samples.at(-1)?.target.x).toBeCloseTo(0.21);
    controller.cancel();
    expect(samples.at(-1)?.target).toEqual(state.paddle);
    controller.dispose();
    const count = samples.length;
    pointer('pointerdown', 0, 0);
    expect(samples).toHaveLength(count);
  });
});
