// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { bindLifecycle } from '../../src/app/lifecycle';

afterEach(() => vi.useRealTimers());
it('resizeの連続通知は即座に停止し、落ち着いた矩形で一度だけ再構成する', () => {
  vi.useFakeTimers();
  const canvas = document.createElement('canvas'), pauses: string[] = [];
  let resized = 0;
  const dispose = bindLifecycle({ canvas, pause(reason) { pauses.push(reason); }, resize() { resized++; }, contextLost() {}, contextRestored() {} });
  for (let n = 0; n < 10; n++) { window.dispatchEvent(new Event(n % 2 ? 'resize' : 'orientationchange')); vi.advanceTimersByTime(10); }
  expect(pauses[0]).toBe('resize');
  expect(resized).toBe(0);
  vi.advanceTimersByTime(100); expect(resized).toBe(1);
  window.dispatchEvent(new Event('resize')); dispose();
  vi.advanceTimersByTime(100); expect(resized).toBe(1);
});
