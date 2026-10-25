// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { DEFAULT_PREFERENCES } from '../../src/storage/preferences';
import { createScreens } from '../../src/ui/screens';
import { scenario } from '../helpers/scenarios';

const cleanup: Array<() => void> = [];
afterEach(() => { for (const dispose of cleanup.splice(0)) dispose(); });

function setup() {
  const root = document.createElement('div'); document.body.append(root);
  const actions = { start: vi.fn(), pause: vi.fn(), resume: vi.fn(), retry: vi.fn(), home: vi.fn(), toggleSound: vi.fn(), retryAudio: vi.fn(), volume: vi.fn(), sensitivity: vi.fn(), quality: vi.fn() };
  const screens = createScreens(root, actions);
  const base = scenario(0).snapshot();
  const render = (phase: typeof base.phase) => screens.render({ ...base, phase, pauseReason: phase === 'paused' ? 'user' : null });
  const get = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  cleanup.push(() => { screens.dispose(); root.remove(); });
  return { root, actions, screens, render, get };
}

function key(target: HTMLElement, value: string, shiftKey = false) {
  const event = new KeyboardEvent('keydown', { key: value, shiftKey, bubbles: true, cancelable: true });
  target.dispatchEvent(event); return event;
}

it('100球落球の終了を残球数とともに読み上げ、新規開始では表示を戻す', () => {
  const { screens, get } = setup();
  const base = scenario(340).snapshot();
  screens.render({ ...base, phase: 'gameover', lostBallCount: 100, balls: [{ id: 1, phase: 'queued', position: { x: 0, y: 0.5, z: -1.95 }, smash: false }] });
  expect(get('[data-status]').textContent).toContain('100球');
  expect(get('[data-status]').textContent).toContain('残球数1');
  expect(get('[data-losses]').textContent).toBe('100 / 100');
  expect(get('[data-loss-limit-message]').hidden).toBe(false);
  screens.render(scenario(0).snapshot());
  expect(get('[data-losses]').textContent).toBe('0 / 100');
  expect(get('[data-loss-limit-message]').hidden).toBe(true);
});

it('最後の演出中は入力を無効にし、結果へ移ってから再挑戦にフォーカスする', () => {
  const {screens,get,actions}=setup();const end={...scenario(340).snapshot(),phase:'gameover' as const,lostBallCount:100};
  screens.render(end,true);
  expect(get('[data-game]').hidden).toBe(false);expect(get('[data-result]').hidden).toBe(true);
  expect(get('[data-testid="input-surface"]').inert).toBe(true);
  expect(document.activeElement).toBe(get('[data-finishing]'));
  key(get('[data-finishing]'),'Escape');expect(actions.pause).not.toHaveBeenCalled();
  expect(get('[data-status]').textContent).toContain('100球');
  screens.render(end,false);
  expect(get('[data-game]').hidden).toBe(true);expect(get('[data-result]').hidden).toBe(false);
  expect(document.activeElement).toBe(get('[data-result] [data-action="retry"]'));
});

it('running exposes the focusable canvas without a header, pad, links, or persistent controls', () => {
  const { root, screens, render, get } = setup(); render('running');
  expect(get('[data-game]').querySelector('.game-header, .input-pad, .game-hint, .wordmark, .court-caption, [data-action="pause"]')).toBeNull();
  expect(screens.canvas.tabIndex).toBe(0);
  expect(document.activeElement).toBe(screens.canvas);
  const activeControls = Array.from(root.querySelectorAll<HTMLElement>('button, a[href], input, select, [tabindex]'))
    .filter(node => node.tabIndex >= 0 && !node.closest('[hidden], [inert]'));
  expect(activeControls).toEqual([screens.canvas]);
  expect(get('.hud').querySelector('button, a, input, [tabindex]')).toBeNull();
});

it('Escape pauses running play and only explicit resume returns focus to the canvas', () => {
  const { actions, screens, render, get } = setup(); render('ready');
  get('[data-action="start"]').click(); expect(actions.start).toHaveBeenCalledTimes(1);
  render('running'); expect(key(screens.canvas, 'Escape').defaultPrevented).toBe(true);
  expect(actions.pause).toHaveBeenCalledTimes(1);
  render('paused'); const resume = get('[data-action="resume"]');
  expect(document.activeElement).toBe(resume);
  key(resume, 'Escape'); expect(actions.resume).not.toHaveBeenCalled(); expect(actions.pause).toHaveBeenCalledTimes(1);
  resume.click(); expect(actions.resume).toHaveBeenCalledTimes(1);
  render('running'); expect(document.activeElement).toBe(screens.canvas);
  screens.canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', repeat: true, bubbles: true }));
  expect(actions.pause).toHaveBeenCalledTimes(1);
});

it('hidden screens are inert and home explains direct placement, release hold, and both pause gestures', () => {
  const { actions, render, get } = setup(); render('running');
  for (const selector of ['[data-home]', '[data-settings]', '[data-result]', '[role="dialog"]']) expect(get(selector).inert).toBe(true);
  get('[data-home] [data-action="start"]').click(); expect(actions.start).not.toHaveBeenCalled();
  render('ready');
  for (const word of ['タップ', 'ドラッグ', '離す', '2本指', 'Esc']) expect(get('[data-home]').textContent).toContain(word);
  get('[data-action="settings"]').click();
  expect(get('[data-home]').inert).toBe(true); expect(get('[data-settings]').inert).toBe(false);
  expect(document.activeElement).toBe(get('#settings-title'));
  expect(get('[data-settings]').querySelector('[aria-label="操作感度"]')).toBeNull();
  expect(get('[data-settings]').textContent).toContain('指やポインターの位置');
  get('[data-action="settings-back"]').click();
  expect(get('[data-settings]').inert).toBe(true); expect(document.activeElement).toBe(get('[data-action="settings"]'));
});

it('settings and pause share sound state, volume, and an explicit audio retry without sensitivity changes', () => {
  const { actions, screens, render, get } = setup();
  screens.setPreferences({ ...DEFAULT_PREFERENCES, volume: 0.3, sensitivity: 1.8 }); screens.setSound(true);
  for (const section of ['[data-settings]', '[role="dialog"]']) {
    expect(get<HTMLInputElement>(`${section} [aria-label="効果音の音量"]`).value).toBe('0.3');
    expect(get(`${section} [data-action="sound"]`).textContent).toBe('音：オフ');
    expect(get(`${section} [data-action="retry-audio"]`).textContent).toContain('再試行');
  }
  render('ready'); get('[data-action="settings"]').click();
  const settingsVolume = get<HTMLInputElement>('[data-settings] [aria-label="効果音の音量"]');
  settingsVolume.value = '0.4'; settingsVolume.dispatchEvent(new Event('input', { bubbles: true }));
  get('[data-settings] [data-action="sound"]').click(); get('[data-settings] [data-action="retry-audio"]').click();
  expect(actions.volume).toHaveBeenLastCalledWith(0.4); expect(actions.toggleSound).toHaveBeenCalledTimes(1); expect(actions.retryAudio).toHaveBeenCalledTimes(1);
  render('paused'); const pauseVolume = get<HTMLInputElement>('[role="dialog"] [aria-label="効果音の音量"]');
  pauseVolume.value = '0.7'; pauseVolume.dispatchEvent(new Event('input', { bubbles: true }));
  get('[role="dialog"] [data-action="sound"]').click(); get('[role="dialog"] [data-action="retry-audio"]').click();
  expect(actions.volume).toHaveBeenLastCalledWith(0.7); expect(actions.volume).toHaveBeenCalledTimes(2);
  expect(actions.toggleSound).toHaveBeenCalledTimes(2); expect(actions.retryAudio).toHaveBeenCalledTimes(2); expect(actions.sensitivity).not.toHaveBeenCalled();
});

it('the pause focus trap includes the volume slider and leaves the canvas inert', () => {
  const { screens, render, get } = setup(); render('paused');
  const first = get('[data-action="resume"]'), last = get<HTMLInputElement>('[role="dialog"] [aria-label="効果音の音量"]');
  expect(screens.surface.inert).toBe(true); expect(get('.hud').inert).toBe(true);
  first.focus(); expect(key(first, 'Tab', true).defaultPrevented).toBe(true); expect(document.activeElement).toBe(last);
  expect(key(last, 'Tab').defaultPrevented).toBe(true); expect(document.activeElement).toBe(first);
  render('running'); expect(screens.surface.inert).toBe(false); expect(get('[role="dialog"]').inert).toBe(true);
});

it('a context loss keeps enabled pause actions and volume reachable', () => {
  const { screens, render, get } = setup(); screens.setContextAvailable(false); render('paused');
  const home = get('[role="dialog"] [data-action="home"]'), volume = get('[role="dialog"] [aria-label="効果音の音量"]');
  expect(get<HTMLButtonElement>('[data-action="resume"]').disabled).toBe(true);
  expect(document.activeElement).toBe(home);
  key(home, 'Tab', true); expect(document.activeElement).toBe(volume);
  key(volume, 'Tab'); expect(document.activeElement).toBe(home);
});

it('audio failure remains visible inside the active pause dialog and clears after recovery', () => {
  const { screens, render, get } = setup(); render('running'); screens.setAudioReady(false);
  expect(get('[data-audio-notice]').hidden).toBe(false);
  render('paused'); expect(get('[role="dialog"]').contains(get('[data-audio-notice]'))).toBe(true);
  expect(get('[data-audio-notice]').closest('[inert]')).toBeNull();
  screens.setAudioReady(true); expect(get('[data-audio-notice]').hidden).toBe(true);
});

it('disposing removes keyboard and delegated form listeners', () => {
  const { root, actions, screens, render } = setup(); render('running'); screens.dispose();
  key(root, 'Escape'); root.dispatchEvent(new Event('input', { bubbles: true }));
  expect(actions.pause).not.toHaveBeenCalled(); expect(actions.volume).not.toHaveBeenCalled();
});
