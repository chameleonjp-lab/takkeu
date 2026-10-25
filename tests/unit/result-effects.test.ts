// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createScreens } from '../../src/ui/screens';
import { scenario } from '../helpers/scenarios';

let dispose = () => {};
afterEach(() => { dispose(); vi.unstubAllGlobals(); });
function setup() {
  let now = 0, id = 0;
  const frames = new Map<number, FrameRequestCallback>();
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { frames.set(++id, fn); return id; });
  vi.stubGlobal('cancelAnimationFrame', (key: number) => { frames.delete(key); });
  let reduced = false;
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', () => ({ get matches() { return reduced; }, addEventListener: (_: string, fn: () => void) => listeners.add(fn), removeEventListener: (_: string, fn: () => void) => listeners.delete(fn) }));
  const root = document.createElement('div'); document.body.append(root);
  const noop = () => {};
  const screens = createScreens(root, { start: noop, pause: noop, resume: noop, retry: noop, home: noop, toggleSound: noop, volume: noop });
  const snapshot = scenario(0).snapshot();
  const render = (score: number, phase: 'gameover' | 'running' = 'gameover', finishing = false) => screens.render({ ...snapshot, score, phase }, finishing);
  const tick = (ms: number) => { now += ms; const callbacks = [...frames.values()]; frames.clear(); for (const fn of callbacks) fn(now); };
  dispose = () => { screens.dispose(); root.remove(); };
  return { root, screens, render, tick, frames, listeners, reduce(value: boolean, notify = true) { reduced = value; if (notify) listeners.forEach(fn => fn()); } };
}

it.each([[299,'normal',[]],[300,'gold',[]],[499,'gold',[]],[500,'gold',['green']],[799,'gold',['green']],
  [800,'rainbow',['green']],[999,'rainbow',['green']],[1000,'rainbow',['green','blue']],
  [1499,'rainbow',['green','blue']],[1500,'rainbow',['green','blue','red']],[2000,'rainbow',['green','blue','red']]] as const)
('uses the exact color/electricity boundary at %i', (score, color, colors) => {
  const { root, render, tick, frames } = setup(); render(score); tick(100); tick(100);
  expect(root.querySelector('[data-result]')!.getAttribute('data-score-color')).toBe(color);
  expect([...new Set([...root.querySelectorAll('[data-bolt]')].map(node => node.getAttribute('data-bolt')))].sort()).toEqual([...colors].sort());
  expect(frames.size).toBe(colors.length ? 1 : 0);
});

it('changes paths and emission points continuously with bounded, independently colored layers', () => {
  const { root, render, tick } = setup(); render(1500);
  const shapes = new Set<string>(), origins = new Set<string>(); let front = 0, back = 0;
  for (let frame = 0; frame < 240; frame++) {
    tick(40); const bolts = [...root.querySelectorAll('[data-bolt]')];
    expect(bolts.length).toBeLessThanOrEqual(5);
    for (const bolt of bolts) {
      shapes.add(bolt.querySelector('path')!.getAttribute('d')!);
      if (!origins.has(bolt.id)) { origins.add(bolt.id); if (bolt.parentElement!.getAttribute('data-lightning-layer') === 'front') front++; else back++; }
    }
  }
  expect(shapes.size).toBeGreaterThan(100); expect(origins.size).toBeGreaterThan(30);
  expect(front / (front + back)).toBeGreaterThan(.15); expect(front / (front + back)).toBeLessThan(.35);
});

it('stops, restarts once, respects live motion preference, and disposes all resources', () => {
  const { root, screens, render, tick, frames, reduce, listeners } = setup();
  render(1500, 'gameover', true); expect(frames.size).toBe(0);
  render(1500); tick(100); render(1500); render(1500); expect(frames.size).toBe(1);
  render(0, 'running'); expect(frames.size).toBe(0); expect(root.querySelectorAll('[data-bolt]').length).toBe(0);
  render(1500); tick(100); expect(frames.size).toBe(1);
  reduce(true); expect(frames.size).toBe(0); expect(root.querySelectorAll('[data-bolt]').length).toBe(0);
  reduce(false); tick(100); expect(frames.size).toBe(1);
  screens.setPreparing(true); expect(frames.size).toBe(0);
  screens.setPreparing(false); expect(frames.size).toBe(1);
  screens.dispose(); expect(frames.size).toBe(0); expect(listeners.size).toBe(0);
});
it('stops while the tab is hidden and resumes only one loop when visible', () => {
  const { render, tick, frames } = setup(); render(1500); tick(100); expect(frames.size).toBe(1);
  const visibility = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  document.dispatchEvent(new Event('visibilitychange')); expect(frames.size).toBe(0);
  visibility.mockReturnValue(false); document.dispatchEvent(new Event('visibilitychange')); tick(100); expect(frames.size).toBe(1);
  visibility.mockRestore();
});

it('clears existing bolts when a frame observes reduced motion before the change event', () => {
  const { root, render, tick, frames, reduce } = setup();
  render(1500); tick(100); tick(100);
  expect(root.querySelectorAll('[data-bolt]').length).toBeGreaterThan(0);
  reduce(true, false); tick(40);
  expect(frames.size).toBe(0);
  expect(root.querySelectorAll('[data-bolt]').length).toBe(0);
  reduce(false); tick(100);
  expect(frames.size).toBe(1);
  expect(root.querySelectorAll('[data-bolt]').length).toBeGreaterThan(0);
});
