// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import type { LoadingState } from '../../src/app/loadingProgress';
import { createLoadingScreen } from '../../src/ui/loading';

const cleanup: Array<() => void> = [];
afterEach(() => { cleanup.splice(0).forEach(fn => fn()); vi.useRealTimers(); });

function setup() {
  const root = document.createElement('div');
  root.innerHTML = '<main><button>既存のホーム</button></main>';
  document.body.append(root);
  const actions = { cancel: vi.fn(), retry: vi.fn() };
  const screen = createLoadingScreen(root, actions);
  cleanup.push(() => { screen.dispose(); root.remove(); });
  const get = <T extends HTMLElement>(selector: string): T => root.querySelector<T>(selector)!;
  const show = (overrides: Partial<LoadingState> = {}) => screen.show({
    percent: 37, stage: 'コートを準備しています', remainingSeconds: 5, elapsedSeconds: 2, error: null, ...overrides,
  });
  return { root, actions, screen, get, show };
}

it('appends a hidden, inert overlay without replacing the existing screen', () => {
  const { root, get } = setup();
  expect(root.querySelector('main')?.textContent).toBe('既存のホーム');
  expect(get('[data-loading-screen]').hidden).toBe(true);
  expect(get('[data-loading-screen]').hasAttribute('inert')).toBe(true);
  expect(root.querySelector('[data-action]')).toBeNull();
});

it('reports the supplied real progress, stage and estimated remaining time accessibly', () => {
  const { show, get } = setup();
  show({ percent: 37.5, remainingSeconds: 4.2 });
  const overlay = get('[data-loading-screen]');
  const progress = get('[data-loading-progress]');
  expect(overlay.hidden).toBe(false);
  expect(overlay.hasAttribute('inert')).toBe(false);
  expect(overlay.getAttribute('role')).toBe('dialog');
  expect(overlay.getAttribute('aria-modal')).toBe('true');
  expect(progress.getAttribute('role')).toBe('progressbar');
  expect(progress.getAttribute('aria-valuemin')).toBe('0');
  expect(progress.getAttribute('aria-valuemax')).toBe('100');
  expect(progress.getAttribute('aria-valuenow')).toBe('37.5');
  expect(progress.getAttribute('aria-label')).toBeTruthy();
  expect(get('[data-loading-percent]').textContent).toBe('37%');
  expect(get('[data-loading-stage]').textContent).toBe('コートを準備しています');
  expect(get('[data-loading-stage]').getAttribute('role')).toBe('status');
  expect(get('[data-loading-eta]').textContent).toBe('あと約5秒（目安）');
  expect(document.activeElement).toBe(get('h2'));
});

it('does not advance progress or promise a finish time when the estimate is unavailable', () => {
  vi.useFakeTimers();
  const { show, get } = setup();
  show({ percent: 42, remainingSeconds: null, elapsedSeconds: 17.9 });
  vi.advanceTimersByTime(30_000);
  expect(get('[data-loading-progress]').getAttribute('aria-valuenow')).toBe('42');
  expect(get('[data-loading-eta]').textContent).toContain('17秒経過');
  expect(get('[data-loading-eta]').textContent).toContain('通常より時間がかかっています');
  expect(get('[data-loading-eta]').textContent).not.toContain('あと約');
  expect(get('[data-loading-action="retry"]').hidden).toBe(true);
});

it('keeps all controls, the one-bounce rule and both end conditions readable while tips rotate', () => {
  const { show, get, root } = setup();
  show({ elapsedSeconds: 0 });
  const firstTip = get('[data-loading-tip]').textContent;
  const rules = get('[data-loading-rules]').textContent!;
  expect(rules).toContain('タップした位置');
  expect(rules).toContain('押したまま');
  expect(rules).toContain('指やポインター');
  expect(rules).toContain('自分の台で1回バウンド');
  const end = get('[data-loading-end]').textContent;
  expect(end).toContain('残球が0');
  expect(end).toContain('累計100球');
  show({ elapsedSeconds: 4 });
  expect(get('[data-loading-tip]').textContent).not.toBe(firstTip);
  expect(get('[data-loading-end]').textContent).toBe(end);
  expect(get('[data-loading-rules]').textContent).toBe(rules);
  expect(root.querySelectorAll('[data-loading-screen]')).toHaveLength(1);
});

it('keeps focus on the user’s control during updates and confines Tab to the overlay', () => {
  const { show, get } = setup();
  show();
  const home = get<HTMLButtonElement>('[data-loading-action="cancel"]');
  home.focus();
  show({ percent: 90, elapsedSeconds: 7 });
  expect(document.activeElement).toBe(home);
  const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  home.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(home);
});

it('updates the live stage only when its message changes', () => {
  const { show, get } = setup();
  show();
  const stage = get('[data-loading-stage]');
  const observer = new MutationObserver(() => {});
  observer.observe(stage, { childList: true, characterData: true, subtree: true });
  cleanup.push(() => observer.disconnect());
  show({ percent: 55, elapsedSeconds: 5 });
  expect(observer.takeRecords()).toHaveLength(0);
  show({ stage: 'ラケットを準備しています' });
  expect(stage.textContent).toBe('ラケットを準備しています');
  expect(observer.takeRecords().length).toBeGreaterThan(0);
});

it('shows a safe error message and requires a deliberate retry or home action', () => {
  const { show, get, actions } = setup();
  show();
  show({ error: '準備が中断しました <img src=x onerror=alert(1)>' });
  const alert = get('[role="alert"]');
  const retry = get<HTMLButtonElement>('[data-loading-action="retry"]');
  expect(alert.hidden).toBe(false);
  expect(alert.textContent).toContain('<img src=x onerror=alert(1)>');
  expect(alert.querySelector('img')).toBeNull();
  expect(get('[data-loading-screen]').getAttribute('aria-busy')).toBe('false');
  expect(get('[data-loading-eta]').hidden).toBe(true);
  expect(retry.hidden).toBe(false);
  expect(document.activeElement).toBe(retry);
  expect(actions.retry).not.toHaveBeenCalled();
  expect(actions.cancel).not.toHaveBeenCalled();
  get<HTMLButtonElement>('[data-loading-action="cancel"]').focus();
  show({ error: '準備が中断しました' });
  expect(document.activeElement).toBe(get('[data-loading-action="cancel"]'));
  retry.click();
  expect(actions.retry).toHaveBeenCalledTimes(1);
  get<HTMLButtonElement>('[data-loading-action="cancel"]').click();
  expect(actions.cancel).toHaveBeenCalledTimes(1);
});

it('resets the error, tip, progress and focus for a new attempt or replay', () => {
  const { show, get, screen, actions } = setup();
  show({ elapsedSeconds: 0 });
  const initialTip = get('[data-loading-tip]').textContent;
  show({ percent: 95, elapsedSeconds: 8, error: '準備が中断しました' });
  show({ percent: 0, elapsedSeconds: 0, remainingSeconds: 2 });
  expect(get('[role="alert"]').hidden).toBe(true);
  expect(get('[data-loading-action="retry"]').hidden).toBe(true);
  expect(get('[data-loading-screen]').getAttribute('aria-busy')).toBe('true');
  expect(document.activeElement).toBe(get('h2'));
  screen.show(null);
  expect(get('[data-loading-screen]').hidden).toBe(true);
  expect(get('[data-loading-screen]').hasAttribute('inert')).toBe(true);
  get<HTMLButtonElement>('[data-loading-action="cancel"]').click();
  expect(actions.cancel).not.toHaveBeenCalled();
  show({ percent: 0, elapsedSeconds: 0, remainingSeconds: 0 });
  expect(get('[data-loading-tip]').textContent).toBe(initialTip);
  expect(get('[data-loading-progress]').getAttribute('aria-valuenow')).toBe('0');
  expect(get('[data-loading-eta]').textContent).toBe('あと約0秒（目安）');
  expect(document.activeElement).toBe(get('h2'));
});

it('allows cancellation while loading and removes its DOM and listeners on idempotent disposal', () => {
  const { show, get, screen, root, actions } = setup();
  show();
  const home = get<HTMLButtonElement>('[data-loading-action="cancel"]');
  expect(home.textContent).toBe('ホームへ');
  home.click();
  expect(actions.cancel).toHaveBeenCalledTimes(1);
  screen.dispose();
  screen.dispose();
  home.click();
  show();
  expect(actions.cancel).toHaveBeenCalledTimes(1);
  expect(root.querySelector('[data-loading-screen]')).toBeNull();
  expect(root.querySelector('main')?.textContent).toBe('既存のホーム');
});

it('centers the instructions in an independent full-screen, vertically scrollable layer', () => {
  const { show, get } = setup();
  const style = document.createElement('style');
  style.textContent = readFileSync(resolve('src/ui/loading.css'), 'utf8');
  document.head.append(style);
  cleanup.push(() => style.remove());
  show();
  const overlay = getComputedStyle(get('[data-loading-screen]'));
  expect(overlay.position).toBe('fixed');
  expect(overlay.zIndex).toBe('10');
  expect(overlay.overflowY).toBe('auto');
  expect(overlay.alignItems).toBe('center');
  expect(getComputedStyle(get('[data-loading-content]')).textAlign).toBe('center');
  expect(getComputedStyle(get('[data-loading-rules]')).textAlign).toBe('center');
});
