// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { bindLifecycle } from '../../src/app/lifecycle';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('開始画面から届くサイズ不変のresizeでは停止しない', () => {
  const pause = vi.fn(), resize = vi.fn();
  const dispose = bindLifecycle({ canvas: document.createElement('canvas'), pause, resize, contextLost() {}, contextRestored() {} });
  window.dispatchEvent(new Event('resize'));
  window.dispatchEvent(new Event('orientationchange'));
  expect(pause).not.toHaveBeenCalled(); expect(resize).not.toHaveBeenCalled();
  dispose();
});

it('モバイルのキーボード・ツールバーによる高さ変更は再配置だけ行い回転では停止する', () => {
  vi.useFakeTimers();
  vi.stubGlobal('innerWidth', 390); vi.stubGlobal('innerHeight', 600);
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  const pause = vi.fn(), resize = vi.fn();
  const dispose = bindLifecycle({ canvas: document.createElement('canvas'), pause, resize, contextLost() {}, contextRestored() {} });
  for (const height of [700, 800, 844]) {
    vi.stubGlobal('innerHeight', height); window.dispatchEvent(new Event('resize'));
  }
  expect(pause).not.toHaveBeenCalled();
  vi.advanceTimersByTime(100); expect(resize).toHaveBeenCalled();
  vi.stubGlobal('innerWidth', 844); vi.stubGlobal('innerHeight', 390);
  window.dispatchEvent(new Event('resize'));
  expect(pause).toHaveBeenCalledExactlyOnceWith('resize');
  dispose();
});

it('デスクトップの実際の高さ変更では即座に停止する', () => {
  vi.useFakeTimers();
  vi.stubGlobal('innerHeight', 600); vi.stubGlobal('matchMedia', () => ({ matches: false }));
  const pause = vi.fn();
  const dispose = bindLifecycle({ canvas: document.createElement('canvas'), pause, resize() {}, contextLost() {}, contextRestored() {} });
  vi.stubGlobal('innerHeight', 800); window.dispatchEvent(new Event('resize'));
  expect(pause).toHaveBeenCalledExactlyOnceWith('resize'); dispose();
});

it('resizeの連続通知は即座に停止し、落ち着いた矩形で一度だけ再構成する', () => {
  vi.useFakeTimers();
  const canvas = document.createElement('canvas'), pauses: string[] = [];
  let resized = 0;
  const dispose = bindLifecycle({ canvas, pause(reason) { pauses.push(reason); }, resize() { resized++; }, contextLost() {}, contextRestored() {} });
  for (let n = 0; n < 10; n++) {
    vi.stubGlobal('innerWidth', 1000 + n); vi.stubGlobal('screen', { orientation: { angle: n * 90 } });
    window.dispatchEvent(new Event(n % 2 ? 'resize' : 'orientationchange')); vi.advanceTimersByTime(10);
  }
  expect(pauses[0]).toBe('resize');
  expect(resized).toBe(0);
  vi.advanceTimersByTime(100); expect(resized).toBe(1);
  window.dispatchEvent(new Event('resize')); dispose();
  vi.advanceTimersByTime(100); expect(resized).toBe(1);
});
