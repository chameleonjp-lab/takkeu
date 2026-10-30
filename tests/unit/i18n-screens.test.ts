// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createScreens } from '../../src/ui/screens';
import * as i18n from '../../src/i18n/i18n';
import { SUPPORTED_LANGUAGES } from '../../src/i18n/languages';
import { DEFAULT_PREFERENCES } from '../../src/storage/preferences';
import { scenario } from '../helpers/scenarios';

const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const dispose of cleanup.splice(0)) dispose();
  i18n.setLanguage('ja'); vi.restoreAllMocks();
});

function setup() {
  const root = document.createElement('div'); document.body.append(root);
  const actions = { start: vi.fn(), pause: vi.fn(), resume: vi.fn(), retry: vi.fn(), home: vi.fn(), toggleSound: vi.fn(), volume: vi.fn(), quality: vi.fn(), retryRanking: vi.fn(), retryPosition: vi.fn(), refreshRanking: vi.fn() };
  const screens = createScreens(root, actions);
  const get = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  cleanup.push(() => { screens.dispose(); root.remove(); });
  return { root, screens, actions, get };
}

it('offers every supported language on home, settings and the pause menu', () => {
  const { root, get } = setup();
  const selectors = root.querySelectorAll<HTMLSelectElement>('[data-language]');
  expect(selectors).toHaveLength(3);
  for (const select of selectors) {
    expect(select.options).toHaveLength(15);
    expect([...select.options].map(option => option.value)).toContain('ja');
    expect([...select.options].map(option => option.value)).toContain('en');
    expect(select.getAttribute('aria-label')).toBeTruthy();
  }
  expect(get('[data-home]').querySelector('[data-language]')).not.toBeNull();
  expect(get('[data-settings]').querySelector('[data-language]')).not.toBeNull();
  expect(get('.pause-overlay').querySelector('[data-language]')).not.toBeNull();
});

it('switches language from either selector without replacing controls or losing edits and focus', () => {
  const { screens, actions, get } = setup();
  const shell = get('.shell'), canvas = screens.canvas, input = get<HTMLInputElement>('[data-player-name]');
  screens.setPlayerName('未送信 Alice');
  input.focus(); input.setSelectionRange(2, 5);
  i18n.setLanguage('en');
  expect(get('.shell')).toBe(shell); expect(screens.canvas).toBe(canvas);
  expect(document.activeElement).toBe(input); expect(input.selectionStart).toBe(2); expect(input.selectionEnd).toBe(5);
  expect(screens.playerName()).toBe('未送信 Alice');
  expect(get('[data-action="start"]').textContent).not.toContain('はじめる');
  expect(get<HTMLSelectElement>('[data-home] [data-language]').value).toBe('en');
  get('[data-action="settings"]').click();
  const language = get<HTMLSelectElement>('[data-settings] [data-language]'); language.focus(); language.value = 'fr';
  language.dispatchEvent(new Event('change', { bubbles: true }));
  expect(i18n.getLanguage()).toBe('fr'); expect(document.activeElement).toBe(language);
  expect(get<HTMLSelectElement>('[data-home] [data-language]').value).toBe('fr');
  expect(get('[data-settings]').hidden).toBe(false); expect(get('[data-home]').hidden).toBe(true);
  expect(actions.start).not.toHaveBeenCalled(); expect(actions.quality).not.toHaveBeenCalled();
});

it('translates static text and accessible labels in every supported language', () => {
  const { root, get, screens } = setup();
  screens.setAudioReady(false); screens.setStorageAvailable(false);
  for (const { id } of SUPPORTED_LANGUAGES) {
    i18n.setLanguage(id);
    expect(get<HTMLSelectElement>('[data-language]').value).toBe(id);
    for (const node of root.querySelectorAll('[data-language] option:checked')) expect(node.textContent?.trim()).toBeTruthy();
    if (id === 'ja') continue;
    expect(get('[data-action="start"]').textContent).not.toContain('はじめる');
    expect(screens.canvas.getAttribute('aria-label')).not.toContain('卓球ゲームの描画領域');
    expect(get('[data-player-name]').getAttribute('placeholder')).not.toContain('名前なしでも遊べます');
    expect(get('[data-audio-notice]').textContent).not.toContain('音声を利用できません');
    expect(get('[data-storage-notice]').textContent).not.toContain('この端末に保存できません');
  }
});

it('reapplies cached result, ranking, sound, and error messages without retrying requests', () => {
  const { screens, actions, get } = setup();
  screens.setPreferences({ ...DEFAULT_PREFERENCES, bestScore: 1250, volume: 0.3 });
  screens.setSound(true); screens.setRankingParticipation(true);
  screens.render({ ...scenario(345).snapshot(), phase: 'gameover', lostBallCount: 100 });
  screens.setResultPosition({ status: 'loaded', rank: 12, total: 1250, bestScore: 1250 });
  screens.setRankingState({ status: 'retryable_failed', pendingCount: 1 });
  screens.setResultHall({ status: 'pending', displayName: 'Alice' });
  screens.setLeaderboard('error'); screens.setHallOfFame('error');
  screens.setError('ランキングを取得できませんでした。時間をおいて更新してください。');
  const result = get('[data-result]'), share = get<HTMLAnchorElement>('[data-share-x]');
  const japaneseShare = share.href;
  const focus = get('[data-result] [data-action="retry"]'); focus.focus();
  i18n.setLanguage('en');
  expect(get('[data-result]')).toBe(result); expect(result.hidden).toBe(false); expect(document.activeElement).toBe(focus);
  expect(get('[data-result-score]').textContent).toBe('345');
  expect(get('[data-position-message]').textContent).toContain('12');
  expect(get('[data-position-message]').textContent).toContain('1,250');
  expect(get('[data-top100]').hidden).toBe(false);
  for (const selector of ['[data-position-message]', '[data-position-note]', '[data-hall-message]', '[data-ranking-status]', '[data-ranking-message]', '[data-hall-list-message]', '[data-error]', '[data-ranking-participation]', '[data-status]', '[data-action="sound"]']) {
    expect(get(selector).textContent).not.toMatch(/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u);
  }
  expect(get('[data-action="ranking-retry"]').hidden).toBe(false);
  expect(get<HTMLInputElement>('[data-volume]').value).toBe('0.3');
  expect(get('[data-loss-limit-message]').hidden).toBe(false);
  expect(share.href).not.toBe(japaneseShare);
  expect(new URL(share.href).searchParams.get('text')).toContain('345');
  expect(actions.retryRanking).not.toHaveBeenCalled(); expect(actions.retryPosition).not.toHaveBeenCalled(); expect(actions.refreshRanking).not.toHaveBeenCalled();
  get('[data-action="ranking-retry"]').click(); expect(actions.retryRanking).toHaveBeenCalledTimes(1);
});

it('keeps user names literal and directionally isolated in ranking and hall messages', () => {
  const { screens, get } = setup();
  const name = '<img src=x onerror=alert(1)> علي Alice';
  const hall = { number: 7, displayName: name, normalizedName: name, registeredAt: '2026-10-27T03:00:00Z' };
  screens.setLeaderboard('loaded', [{ rank: 2, displayName: name, score: 3500, playCount: 5 }]);
  screens.setHallOfFame('loaded', [hall]); screens.setResultHall({ status: 'registered', hall });
  for (const language of ['ja', 'en', 'zh-Hans'] as const) {
    i18n.setLanguage(language);
    for (const selector of ['[data-ranking-body]', '[data-hall-list]', '[data-hall-note]']) {
      const container = get(selector), isolated = container.querySelector('bdi');
      expect(isolated?.textContent).toBe(name); expect(isolated?.getAttribute('dir')).toBe('auto');
      expect(container.querySelector('img, script')).toBeNull();
    }
  }
  expect(get('[data-player-name]').getAttribute('dir')).toBe('auto');
});

it('refreshes paused and running messages without moving focus or translating every frame', () => {
  const { screens, actions, get } = setup();
  const base = scenario(99).snapshot();
  screens.render({ ...base, phase: 'paused', pauseReason: 'resize', lostBallCount: 96 });
  const resume = get('[data-action="resume"]'); resume.focus();
  i18n.setLanguage('en');
  expect(document.activeElement).toBe(resume);
  expect(get('[data-pause-message]').textContent).not.toContain('画面の向き');
  expect(get('[data-losses-label]').textContent).toContain('4');
  const running = { ...base, phase: 'running' as const, pauseReason: null };
  screens.render(running);
  const translate = vi.spyOn(i18n, 't'); translate.mockClear();
  for (let i = 1; i <= 20; i++) screens.render({ ...running, simTime: i / 60 });
  expect(translate).not.toHaveBeenCalled();
  i18n.setLanguage('fr');
  expect(document.activeElement).toBe(screens.canvas); expect(get('[data-game]').hidden).toBe(false);
  expect(actions.pause).not.toHaveBeenCalled(); expect(actions.resume).not.toHaveBeenCalled();
});

it('unsubscribes language updates when screens are disposed', () => {
  const { root, screens } = setup(); screens.dispose();
  expect(() => i18n.setLanguage('en')).not.toThrow(); expect(root.childNodes).toHaveLength(0);
});

it('allows an actual pause-menu selection while preserving the pause, canvas and action ownership',()=>{
  const {screens,actions,get}=setup();
  const snapshot={...scenario(555).snapshot(),phase:'paused' as const,pauseReason:'user' as const,lostBallCount:35};
  screens.render(snapshot);const canvas=screens.canvas,select=get<HTMLSelectElement>('.pause-overlay [data-language]');
  expect(select).not.toBeNull();select.focus();select.value='en';select.dispatchEvent(new Event('change',{bubbles:true}));
  expect(i18n.getLanguage()).toBe('en');expect(document.activeElement).toBe(select);
  expect(screens.canvas).toBe(canvas);expect(get('.pause-overlay').hidden).toBe(false);
  expect(get('[data-score]').textContent).toBe('555');expect(get('[data-losses]').textContent).toBe('35 / 100');
  expect(actions.start).not.toHaveBeenCalled();expect(actions.retry).not.toHaveBeenCalled();
  expect(actions.home).not.toHaveBeenCalled();expect(actions.resume).not.toHaveBeenCalled();
});
