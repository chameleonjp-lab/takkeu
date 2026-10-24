// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createSwipeController } from '../../src/input/swipe';
import type { InputSample, PaddlePoint } from '../../src/game/types';

type PointerOptions = { id?: number; type?: string; primary?: boolean; button?: number; buttons?: number; at?: number; target?: EventTarget };
const controllers: ReturnType<typeof createSwipeController>[] = [];
function setup() {
  document.body.innerHTML = '<div id="surface"><button>停止</button><input type="range"><a href="#">設定</a></div>';
  const element = document.querySelector<HTMLElement>('#surface')!;
  const samples: InputSample[] = [];
  const state = { interruptions: 0, pauses: 0, running: true, current: true, before: (_at: number): void => {}, reads: 0 };
  const captures = new Set<number>();
  element.setPointerCapture = id => { captures.add(id); };
  element.hasPointerCapture = id => captures.has(id);
  element.releasePointerCapture = id => {
    captures.delete(id);
    const event = new Event('lostpointercapture'); Object.defineProperty(event, 'pointerId', { value: id }); element.dispatchEvent(event);
  };
  const mapping = {
    screen: { left: 20, top: 10, width: 200, height: 100 },
    isCurrent: () => state.current,
    toWorld(x: number, y: number): PaddlePoint {
      state.reads++;
      return { x: Math.min(1, Math.max(-1, (x - 20) / 100 - 1)), y: Math.min(0.85, Math.max(0.15, 0.85 - (y - 10) * 0.007)) };
    },
  };
  const options = {
    mapping, onTarget: (sample: InputSample) => samples.push(sample),
    toSimTime: (timestamp: number) => timestamp / 1000,
    beforeInput: (at: number) => state.before(at), canStart: () => state.running,
    onInterruption: () => state.interruptions++, onPauseGesture: () => state.pauses++,
  };
  const controller = createSwipeController(element, options); controllers.push(controller);
  const pointer = (kind: string, x: number, y: number, options: PointerOptions = {}) => {
    const { id = 1, type = 'mouse', primary = true, button = 0, buttons = kind === 'pointerup' ? 0 : 1, at = 1000, target = element } = options;
    const event = new MouseEvent(kind, { bubbles: true, cancelable: true, button, buttons });
    Object.defineProperties(event, {
      pointerId: { value: id }, pointerType: { value: type }, isPrimary: { value: primary },
      clientX: { value: x }, clientY: { value: y }, timeStamp: { value: at },
    });
    target.dispatchEvent(event);
  };
  return { controller, samples, state, pointer, element, mapping, captures };
}
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.innerHTML = ''; });

describe('direct paddle pointer ownership', () => {
  it('can keep a held touch while mobile chrome changes the mapping', () => {
    const { pointer, samples, state, controller, mapping, captures } = setup();
    pointer('pointerdown', 70, 60, { type: 'touch', at: 100 });
    pointer('pointermove', 120, 60, { type: 'touch', at: 110 });
    controller.updateMapping({ ...mapping, toWorld: () => ({ x: .75, y: .4 }) }, true);
    pointer('pointermove', 170, 60, { type: 'touch', at: 120 });
    expect(samples.at(-1)).toEqual({ at: .12, kind: 'move', target: { x: .75, y: .4 } });
    expect(captures.has(1)).toBe(true);
    pointer('pointerup', 170, 60, { type: 'touch', at: 130 });
    expect(samples.at(-1)).toEqual({ at: .13, kind: 'release', target: { x: .75, y: .4 } });
    expect(state.interruptions).toBe(0);
  });

  it('a chrome mapping update cancels a partial two-finger pause gesture', () => {
    const { pointer, state, controller, mapping } = setup();
    pointer('pointerdown', 70, 60, { type: 'touch', at: 100 });
    pointer('pointerdown', 170, 60, { type: 'touch', id: 2, primary: false, at: 120 });
    controller.updateMapping(mapping, true);
    pointer('pointerup', 70, 60, { type: 'touch', at: 140 });
    pointer('pointerup', 170, 60, { type: 'touch', id: 2, primary: false, at: 150 });
    expect(state.pauses).toBe(0);
  });

  it.each(['mouse', 'touch', 'pen'])('places immediately at the primary %s pointer and follows absolute movement', type => {
    const { pointer, samples } = setup();
    pointer('pointerdown', 200, 100, { type, at: 100 });
    expect(samples).toEqual([{ at: 0.1, kind: 'place', target: { x: 0.8, y: 0.21999999999999997 } }]);
    pointer('pointermove', 70, 40, { type, at: 104 });
    expect(samples.at(-1)).toEqual({ at: 0.104, kind: 'move', target: { x: -0.5, y: 0.64 } });
  });

  it('holds the last accepted movement on release, including movement queued in the same frame', () => {
    const { pointer, samples, state } = setup();
    pointer('pointerdown', 120, 60, { at: 100 });
    pointer('pointermove', 200, 20, { at: 101 });
    pointer('pointerup', 25, 105, { at: 102 });
    expect(samples.map(sample => sample.kind)).toEqual(['place', 'move', 'release']);
    expect(samples.at(-1)).toEqual({ ...samples[1], at: 0.102, kind: 'release' });
    const count = samples.length;
    pointer('lostpointercapture', 25, 105);
    pointer('pointermove', 120, 60);
    expect(samples).toHaveLength(count);
    expect(state.interruptions).toBe(0);
  });

  it('rejects an outside start and clamps captured movement outside every canvas edge', () => {
    const { pointer, samples } = setup();
    for (const [x, y] of [[19, 60], [221, 60], [120, 9], [120, 111]]) pointer('pointerdown', x!, y!);
    expect(samples).toHaveLength(0);
    pointer('pointerdown', 120, 60);
    pointer('pointermove', -900, 900, { target: document });
    expect(samples.at(-1)?.target).toEqual({ x: -1, y: 0.15 });
    pointer('pointermove', 900, -900, { target: document });
    expect(samples.at(-1)?.target).toEqual({ x: 1, y: 0.85 });
  });

  it('ignores hover, secondary buttons, nonprimary starts and interactive controls', () => {
    const { pointer, samples, element } = setup();
    pointer('pointermove', 120, 60, { buttons: 0 });
    pointer('pointerdown', 120, 60, { button: 2, buttons: 2 });
    pointer('pointerdown', 120, 60, { type: 'touch', primary: false });
    for (const control of element.querySelectorAll('button, input, a')) pointer('pointerdown', 120, 60, { target: control });
    expect(samples).toHaveLength(0);
  });

  it.each(['mouse', 'pen'])('ignores %s hover or nonprimary-button movement after a primary press', type => {
    const { pointer, samples } = setup();
    pointer('pointerdown', 70, 60, { type });
    pointer('pointermove', 170, 60, { type, buttons: 0 });
    pointer('pointermove', 170, 60, { type, buttons: 2 });
    pointer('pointerup', 170, 60, { type });
    expect(samples.map(sample => sample.kind)).toEqual(['place', 'release']);
    expect(samples.map(sample => sample.target.x)).toEqual([-0.5, -0.5]);
  });

  it('does not let an extra contact take ownership after the owner lifts', () => {
    const { pointer, samples } = setup();
    pointer('pointerdown', 70, 60, { type: 'touch', at: 100 });
    pointer('pointerdown', 170, 60, { type: 'touch', id: 2, primary: false, at: 120 });
    pointer('pointermove', 200, 20, { type: 'touch', id: 2, primary: false, at: 130 });
    pointer('pointerup', 70, 60, { type: 'touch', at: 140 });
    pointer('pointerdown', 210, 30, { type: 'pen', id: 3, at: 150 });
    pointer('pointermove', 190, 20, { type: 'touch', id: 2, primary: false, at: 160 });
    expect(samples.map(sample => sample.kind)).toEqual(['place', 'release']);
    pointer('pointerup', 170, 60, { type: 'touch', id: 2, primary: false, at: 170 });
    pointer('pointerup', 210, 30, { type: 'pen', id: 3, at: 180 });
    pointer('pointerdown', 170, 60, { type: 'touch', at: 190 });
    expect(samples.at(-1)).toMatchObject({ at: 0.19, kind: 'place', target: { x: 0.5 } });
    expect(samples.at(-1)?.target.y).toBeCloseTo(0.5, 12);
  });

  it('tracks extra contacts that start outside the canvas until they lift', () => {
    const { pointer, samples } = setup();
    pointer('pointerdown', 70, 60, { type: 'touch' });
    pointer('pointerdown', 700, 60, { type: 'touch', id: 2, primary: false, target: document });
    pointer('pointerup', 70, 60, { type: 'touch' });
    pointer('pointerdown', 170, 60, { type: 'pen', id: 3 });
    expect(samples).toHaveLength(2);
    pointer('pointerup', 700, 60, { type: 'touch', id: 2, primary: false, target: document });
    pointer('pointerup', 170, 60, { type: 'pen', id: 3 });
    pointer('pointerdown', 170, 60);
    expect(samples).toHaveLength(3);
  });

  it.each(['pointercancel', 'lostpointercapture'])('clears the whole sequence on unexpected %s without appending stale input', kind => {
    const { pointer, samples, state, captures } = setup();
    pointer('pointerdown', 70, 60, { type: 'touch' });
    pointer('pointerdown', 170, 60, { type: 'touch', id: 2, primary: false });
    pointer(kind, 70, 60, { type: 'touch' });
    expect(samples).toHaveLength(1); expect(state.interruptions).toBe(1); expect(captures.size).toBe(0);
    pointer('pointerup', 70, 60, { type: 'touch' });
    pointer('pointerup', 170, 60, { type: 'touch', id: 2, primary: false });
    expect(state.pauses).toBe(0); expect(state.interruptions).toBe(1);
    pointer('pointerdown', 120, 60);
    expect(samples).toHaveLength(2);
  });

  it('treats cancellation of the second finger as an interruption too', () => {
    const { pointer, samples, state } = setup();
    pointer('pointerdown', 70, 60, { type: 'touch' });
    pointer('pointerdown', 170, 60, { type: 'touch', id: 2, primary: false });
    pointer('pointercancel', 170, 60, { type: 'touch', id: 2, primary: false });
    pointer('pointermove', 120, 60, { type: 'touch' });
    expect(samples).toHaveLength(1); expect(state.interruptions).toBe(1); expect(state.pauses).toBe(0);
  });

  it.each(['cancel', 'updateMapping', 'dispose'] as const)('%s clears input without enqueueing a hold from a stale snapshot', action => {
    const { pointer, samples, state, controller, mapping, captures } = setup();
    pointer('pointerdown', 70, 60);
    pointer('pointermove', 170, 60);
    if (action === 'updateMapping') controller.updateMapping(mapping); else controller[action]();
    pointer('pointerup', 170, 60); pointer('pointermove', 120, 60);
    expect(samples).toHaveLength(2); expect(captures.size).toBe(0); expect(state.interruptions).toBe(0);
  });

  it('preserves ordered rapid taps and their distinct placements', () => {
    const { pointer, samples } = setup();
    for (const [x, at] of [[70, 100], [170, 102], [120, 104]]) {
      pointer('pointerdown', x!, 60, { at: at! }); pointer('pointerup', x!, 60, { at: at! + 1 });
    }
    expect(samples.map(sample => sample.kind)).toEqual(['place', 'release', 'place', 'release', 'place', 'release']);
    expect(samples.map(sample => sample.target.x)).toEqual([-0.5, -0.5, 0.5, 0.5, 0, 0]);
    expect(samples.map(sample => sample.at)).toEqual([0.1, 0.101, 0.102, 0.103, 0.104, 0.105]);
  });

  it('rechecks the running guard after flushing input and rejects menu-time input', () => {
    const { pointer, samples, state } = setup();
    state.running = false; pointer('pointerdown', 120, 60); expect(samples).toHaveLength(0);
    state.running = true; state.before = () => { state.running = false; };
    pointer('pointerdown', 70, 60); expect(samples).toHaveLength(0);
    state.running = true; state.before = () => {};
    pointer('pointerdown', 70, 60); expect(samples).toHaveLength(1);
    state.before = () => { state.running = false; };
    pointer('pointermove', 170, 60); pointer('pointerup', 170, 60);
    expect(samples).toHaveLength(1);
  });

  it('does not resurrect an owner cancelled during beforeInput', () => {
    const { pointer, samples, state, controller } = setup();
    state.before = () => controller.cancel();
    pointer('pointerdown', 70, 60);
    expect(samples).toHaveLength(0);
  });

  it('rejects stale mapping before both placement and movement, including changes during beforeInput', () => {
    const { pointer, samples, state } = setup();
    state.current = false; pointer('pointerdown', 70, 60); expect(samples).toHaveLength(0);
    state.current = true; pointer('pointerdown', 70, 60); expect(samples).toHaveLength(1);
    state.before = () => { state.current = false; };
    pointer('pointermove', 170, 60); pointer('pointerup', 170, 60);
    expect(samples).toHaveLength(1);
  });

  it('ignores nonfinite pointer coordinates and timestamps without poisoning the accepted target', () => {
    const { pointer, samples } = setup();
    for (const bad of [NaN, Infinity, -Infinity]) {
      pointer('pointerdown', bad, 60); pointer('pointerdown', 70, bad); pointer('pointerdown', 70, 60, { at: bad });
    }
    expect(samples).toHaveLength(0);
    pointer('pointerdown', 70, 60);
    for (const bad of [NaN, Infinity, -Infinity]) {
      pointer('pointermove', bad, 60); pointer('pointermove', 70, bad); pointer('pointermove', 170, 60, { at: bad });
    }
    pointer('pointerup', 210, 20);
    expect(samples).toHaveLength(2);
    expect(samples.map(sample => sample.target.x)).toEqual([-0.5, -0.5]);
    for (const sample of samples) expect(sample.target.y).toBeCloseTo(0.5, 12);
  });
});

describe('two-touch tap pause gesture', () => {
  it.each([true, false])('pauses only after both fingers lift (owner first: %s), without delaying paddle input', ownerFirst => {
    const { pointer, samples, state } = setup();
    pointer('pointerdown', 70, 60, { type: 'touch', at: 100 });
    expect(samples.map(sample => sample.kind)).toEqual(['place']);
    pointer('pointermove', 76, 68, { type: 'touch', at: 110 });
    expect(samples.map(sample => sample.kind)).toEqual(['place', 'move']);
    pointer('pointerdown', 170, 60, { type: 'touch', id: 2, primary: false, at: 200 });
    const first = ownerFirst ? { id: 1, primary: true, x: 76, y: 68 } : { id: 2, primary: false, x: 170, y: 60 };
    const last = ownerFirst ? { id: 2, primary: false, x: 170, y: 60 } : { id: 1, primary: true, x: 76, y: 68 };
    pointer('pointerup', first.x, first.y, { ...first, type: 'touch', at: 300 });
    expect(state.pauses).toBe(0);
    pointer('pointerup', last.x, last.y, { ...last, type: 'touch', at: 350 });
    expect(state.pauses).toBe(1); expect(samples.map(sample => sample.kind)).toEqual(['place', 'move', 'release']);
  });

  it.each(['late second', 'late release', 'owner drag', 'second drag', 'release jump', 'third contact', 'mixed devices'])('rejects %s as a pause gesture', failure => {
    const { pointer, samples, state } = setup();
    pointer('pointerdown', 70, 60, { type: 'touch', at: 100 });
    if (failure === 'owner drag') {
      pointer('pointermove', 81, 60, { type: 'touch', at: 110 });
      pointer('pointermove', 70, 60, { type: 'touch', at: 120 });
    }
    pointer('pointerdown', 170, 60, { type: failure === 'mixed devices' ? 'pen' : 'touch', id: 2, primary: false, at: failure === 'late second' ? 201 : 140 });
    if (failure === 'second drag') {
      pointer('pointermove', 170, 71, { type: 'touch', id: 2, primary: false, at: 150 });
      pointer('pointermove', 170, 60, { type: 'touch', id: 2, primary: false, at: 160 });
    }
    if (failure === 'third contact') {
      pointer('pointerdown', 120, 60, { type: 'touch', id: 3, primary: false, at: 150 });
      pointer('pointerup', 120, 60, { type: 'touch', id: 3, primary: false, at: 160 });
    }
    pointer('pointerup', failure === 'release jump' ? 81 : 70, 60, { type: 'touch', at: 220 });
    pointer('pointerup', 170, 60, { type: 'touch', id: 2, primary: false, at: failure === 'late release' ? 351 : 240 });
    expect(state.pauses).toBe(0);
    expect(samples.at(-1)?.kind).toBe('release');
  });
});
