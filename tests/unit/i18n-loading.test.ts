// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app/createApp';
import { createLoadingProgress, waitForPreparation } from '../../src/app/loadingProgress';
import { DEFAULT_CONFIG } from '../../src/game/config';
import { createSession } from '../../src/game/session';
import * as i18n from '../../src/i18n/i18n';
import type { Play } from '../../src/ranking/client';
import { createLoadingScreen } from '../../src/ui/loading';
import { createRallyNotice } from '../../src/ui/rallyNotice';
import { scenario } from '../helpers/scenarios';

const cleanup: Array<() => void> = [];
beforeEach(() => { i18n.setLanguage('ja'); });
afterEach(() => {
  cleanup.splice(0).forEach(dispose => dispose());
  i18n.setLanguage('ja');
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
});

function loading() {
  const root = document.createElement('div'); document.body.append(root);
  let retries = 0, cancellations = 0;
  const screen = createLoadingScreen(root, { retry() { retries++; }, cancel() { cancellations++; } });
  cleanup.push(() => { screen.dispose(); root.remove(); });
  const get = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  return { screen, get, actions: () => ({ retries, cancellations }) };
}

it('retranslates the current preparation and error without rebuilding the overlay or moving focus', () => {
  const { screen, get, actions } = loading();
  const progress = createLoadingProgress(() => 4000);
  progress.report('ranking', .5);
  const state = progress.state('ランキング通信に失敗しました（503）。');
  screen.show(state);
  expect(get('[data-loading-screen]').textContent).toContain('最大30球で、3500ラリーを目指そう。');
  const overlay = get('[data-loading-screen]');
  const meter = get('[data-loading-progress]');
  const home = get<HTMLButtonElement>('[data-loading-action="cancel"]'); home.focus();
  i18n.setLanguage('en');
  expect(get('[data-loading-screen]')).toBe(overlay);
  expect(get('[data-loading-progress]')).toBe(meter);
  expect(get('[data-loading-stage]').textContent).not.toContain('ランキングを確認しています');
  expect(get('[role="alert"]').textContent).toContain('503');
  expect(get('[role="alert"]').textContent).not.toContain('ランキング通信に失敗しました');
  expect(get('h3').textContent).not.toContain('遊び方をチェック');
  expect(get('[data-loading-goal]').textContent).not.toContain('最大30球で');
  expect(meter.getAttribute('aria-label')).not.toBe('ゲームの準備');
  expect(document.activeElement).toBe(home);
  expect(actions()).toEqual({ retries: 0, cancellations: 0 });
  expect(state.stage).toBe('ランキングを確認しています');
  expect(state.error).toBe('ランキング通信に失敗しました（503）。');
  i18n.setLanguage('ja');
  expect(get('[data-loading-stage]').textContent).toBe('ランキングを確認しています');
  expect(get('[role="alert"]').textContent).toBe('ランキング通信に失敗しました（503）。');
  expect(document.activeElement).toBe(home);
});

it('keeps stages and asynchronous timeout errors translatable after language changes', async () => {
  vi.useFakeTimers();
  const { screen, get } = loading();
  let now = 0;
  const progress = createLoadingProgress(() => now);
  progress.report('sound', .5); now = 11_100;
  const pending = waitForPreparation(new Promise<never>(() => {}), 1000, new AbortController().signal);
  const rejected = pending.catch(error => error as Error);
  screen.show(progress.state());
  i18n.setLanguage('en');
  expect(get('[data-loading-stage]').textContent).not.toContain('効果音を準備しています');
  expect(get('[data-loading-eta]').textContent).toContain('11');
  expect(get('[data-loading-eta]').textContent).not.toContain('通常より時間がかかっています');
  await vi.advanceTimersByTimeAsync(1000);
  const error = await rejected;
  expect(error.message).toBe('準備に時間がかかっています。もう一度お試しください。');
  screen.show(progress.state(error.message));
  expect(get('[role="alert"]').textContent).not.toContain('準備に時間がかかっています');
  i18n.setLanguage('ja');
  expect(get('[role="alert"]').textContent).toBe(error.message);
});

it('does not translate unchanged loading text on repeated animation frames and unsubscribes on disposal', () => {
  const { screen, get } = loading();
  const state = { percent: 37, stage: 'コートとラケットを準備しています', remainingSeconds: 4.8, elapsedSeconds: 2.1, error: null };
  screen.show(state);
  const translate = vi.spyOn(i18n, 't');
  for (let frame = 0; frame < 30; frame++) screen.show({ ...state, remainingSeconds: 4.8 - frame / 100, elapsedSeconds: 2.1 + frame / 100 });
  expect(translate).not.toHaveBeenCalled();
  const heading = get('h2'); const previousHeading = heading.textContent;
  screen.dispose(); i18n.setLanguage('en');
  expect(heading.textContent).toBe(previousHeading);
  expect(translate).not.toHaveBeenCalled();
});

it('updates the visible rally cue when language changes without announcing the same achievement again', () => {
  const root = document.createElement('div');
  root.innerHTML = '<div class="hud"><div><output data-score>81</output></div></div>';
  const notice = createRallyNotice(root);
  cleanup.push(() => notice.dispose());
  const snapshot = scenario(81, 5).snapshot();
  const frame = { notice: null, bestAt: 5, goldAt: null };
  notice.update(snapshot, frame);
  const toast = root.querySelector('[data-rally-notice]')!;
  const live = root.querySelector('[data-rally-live]')!;
  expect(live.textContent).toBe('自己ベスト更新！');
  const observer = new MutationObserver(() => {}); observer.observe(live, { childList: true, subtree: true, characterData: true });
  cleanup.push(() => observer.disconnect());
  i18n.setLanguage('en');
  expect(toast.textContent).not.toBe('自己ベスト更新！');
  expect(live.textContent).toBe('自己ベスト更新！');
  notice.update({ ...snapshot, simTime: 5.5 }, frame);
  expect(observer.takeRecords()).toHaveLength(0);
  const translate = vi.spyOn(i18n, 't');
  for (let tick = 0; tick < 10; tick++) notice.update({ ...snapshot, simTime: 5.6 + tick / 100 }, frame);
  expect(translate).not.toHaveBeenCalled();
  i18n.setLanguage('ja');
  expect(toast.textContent).toBe('自己ベスト更新！');
  notice.dispose(); translate.mockClear(); i18n.setLanguage('en');
  expect(translate).not.toHaveBeenCalled();
});

function preparingApp(initialLanguage: string | null = 'ja', ownerDocument = document) {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 16) as unknown as number);
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  const root = ownerDocument.createElement('div'); ownerDocument.body.append(root);
  const session = createSession(DEFAULT_CONFIG, 7);
  const calls = { view: 0, preparation: 0, audio: 0, ranking: 0, draws: 0 };
  let rejectRanking: (error: Error) => void = () => {};
  const stored = new Map<string, string>();
  if (initialLanguage) stored.set(i18n.LANGUAGE_STORAGE_KEY, initialLanguage);
  const app = createApp(root, { createSession: () => session,
    createView() {
      calls.view++;
      return { prepare: async () => { calls.preparation++; }, render() { calls.draws++; }, resize() {}, setQuality() {},
        inputMapping: () => ({ screen: { left: 0, top: 0, width: 390, height: 844 }, isCurrent: () => true, toWorld: () => ({ x: 0, y: .5 }) }),
        dispose() {}, resources: () => ({ geometries: 0, textures: 0, programs: 0, drawCalls: 0, particles: 0, particleCapacity: 0 }) };
    },
    createAudio: () => ({ prepare: async () => { calls.audio++; return true; }, unlock: async () => true, consume() {}, setVolume() {}, setMuted() {}, suspend() {}, reset() {}, dispose: async () => {} }),
    storage: { getItem: key => stored.get(key) ?? null, setItem: (key, value) => { stored.set(key, value); } },
    rankingApi: { start() { calls.ranking++; return new Promise<Play>((_resolve, reject) => { rejectRanking = reject; }); },
      startGuest: async () => {}, finish: async () => {}, submit: async () => {}, top: async () => [], position: async () => null },
  });
  root.querySelector('.canvas-wrap')!.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, width: 390, height: 844, right: 390, bottom: 844, toJSON() {} });
  root.querySelector<HTMLInputElement>('[data-player-name]')!.value = 'Player';
  cleanup.push(() => { app.dispose(); root.remove(); });
  return { root, session, calls, failRanking: (error: Error) => rejectRanking(error) };
}

it('initializes document language and title from the app storage before creating its screens', () => {
  const app = preparingApp('en');
  expect(i18n.getLanguage()).toBe('en');
  expect(document.documentElement.lang).toBe('en');
  expect(document.title).not.toContain('ラリーをつなごう');
  const canvas = app.root.querySelector('canvas');
  i18n.setLanguage('ja');
  expect(document.documentElement.lang).toBe('ja');
  expect(document.title).toBe('タッケウ — ラリーをつなごう');
  expect(app.root.querySelector('canvas')).toBe(canvas);
});

it('uses the root document browser preferences when no language is stored', () => {
  const iframe = document.createElement('iframe'); document.body.append(iframe);
  const frameDocument = iframe.contentDocument!;
  Object.defineProperty(frameDocument.defaultView!.navigator, 'languages', { configurable: true, value: ['fr-FR'] });
  preparingApp(null, frameDocument);
  cleanup.push(() => iframe.remove());
  expect(i18n.getLanguage()).toBe('fr');
  expect(frameDocument.documentElement.lang).toBe('fr');
});

it('switches during a ranking request and retranslates its later error without restarting preparation', async () => {
  const app = preparingApp();
  app.root.querySelector<HTMLButtonElement>('[data-action="start"]')!.click();
  await vi.advanceTimersByTimeAsync(100);
  const before = app.session.snapshot(); const canvas = app.root.querySelector('canvas');
  expect(app.calls).toMatchObject({ view: 1, preparation: 1, audio: 1, ranking: 1 });
  const calls = { ...app.calls };
  i18n.setLanguage('en');
  expect(app.root.querySelector('[data-loading-stage]')!.textContent).not.toContain('ランキングを確認しています');
  expect(app.calls).toEqual(calls);
  expect(app.session.snapshot()).toEqual(before);
  expect(app.root.querySelector('canvas')).toBe(canvas);
  app.failRanking(new Error('ランキング通信に失敗しました（503）。'));
  await vi.advanceTimersByTimeAsync(0);
  const alert = app.root.querySelector('[data-loading-screen] [role="alert"]')!;
  expect(alert.textContent).toContain('503');
  expect(alert.textContent).not.toContain('ランキング通信に失敗しました');
  i18n.setLanguage('ja');
  expect(alert.textContent).toBe('ランキング通信に失敗しました（503）。');
  expect(app.calls).toEqual(calls);
});
