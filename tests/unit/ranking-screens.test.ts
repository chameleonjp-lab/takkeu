// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createScreens } from '../../src/ui/screens';
import { scenario } from '../helpers/scenarios';
import { DEFAULT_PREFERENCES } from '../../src/storage/preferences';

const cleanup: Array<() => void> = [];
afterEach(() => cleanup.splice(0).forEach(fn => fn()));
function setup() {
  const root = document.createElement('div'); document.body.append(root);
  const actions = { start: vi.fn(), pause: vi.fn(), resume: vi.fn(), retry: vi.fn(), home: vi.fn(), toggleSound: vi.fn(), volume: vi.fn(), retryRanking: vi.fn(), refreshRanking: vi.fn() };
  const screens = createScreens(root, actions);
  cleanup.push(() => { screens.dispose(); root.remove(); });
  const get = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  return { root, screens, actions, get };
}

it('makes the optional public name clear and permits an empty-name start', () => {
  const { screens, actions, get } = setup();
  const input = get<HTMLInputElement>('[data-player-name]');
  expect(input.required).toBe(false);
  expect(get('[data-name-note]').textContent).toContain('公開');
  expect(screens.playerName()).toBe('');
  get('[data-action="start"]').click(); expect(actions.start).toHaveBeenCalledTimes(1);
});

it('places replay immediately under the score and shares the actual score and canonical URL', () => {
  const { screens, get } = setup();
  screens.render({ ...scenario(42).snapshot(), phase: 'gameover' });
  expect(get('[data-result-score]').nextElementSibling).toBe(get('[data-result] [data-action="retry"]'));
  const url = new URL(get<HTMLAnchorElement>('[data-share-x]').href);
  expect(url.hostname).toBe('twitter.com');
  expect(url.searchParams.get('text')).toBe('タッケウで42ラリー達成！\n何ラリーつなげられる？ #タッケウ');
  expect(url.searchParams.get('url')).toBe('https://chameleonjp-lab.github.io/takkeu/');
});

it('keeps home best and the current finalized result separate through retry and home', () => {
  const { screens, get } = setup();
  const result = get<HTMLAnchorElement>('[data-share-x]');
  screens.setPreferences({ ...DEFAULT_PREFERENCES, bestScore: 200 });
  const home = get<HTMLAnchorElement>('[data-share-home-x]');
  expect(home).not.toBeNull();
  expect(home.closest('footer')).not.toBeNull();
  expect(home.textContent).toBe('Xでシェア');
  expect(new URL(home.href).searchParams.get('text')).toBe('卓球ゲーム「タッケウ」で自己ベスト200ラリー！\n何ラリーつなげられる？ #タッケウ');
  for (const link of [home, result]) {
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener noreferrer');
  }
  expect(result.hasAttribute('href')).toBe(false);
  expect(result.getAttribute('aria-disabled')).toBe('true');
  expect(result.tabIndex).toBe(-1);
  screens.render({ ...scenario(37).snapshot(), phase: 'running' });
  expect(result.hasAttribute('href')).toBe(false);
  screens.render({ ...scenario(37).snapshot(), phase: 'gameover' });
  expect(new URL(result.href).searchParams.get('text')).toBe('タッケウで37ラリー達成！\n何ラリーつなげられる？ #タッケウ');
  expect(result.hasAttribute('aria-disabled')).toBe(false);
  expect(result.tabIndex).toBe(0);
  screens.setPreferences({ ...DEFAULT_PREFERENCES, bestScore: 250 });
  expect(new URL(result.href).searchParams.get('text')).toContain('37ラリー');
  screens.render({ ...scenario(0).snapshot(), phase: 'running' });
  expect(result.hasAttribute('href')).toBe(false);
  screens.render({ ...scenario(0).snapshot(), phase: 'gameover' });
  expect(new URL(result.href).searchParams.get('text')).toBe('タッケウで0ラリー達成！\n何ラリーつなげられる？ #タッケウ');
  screens.render({ ...scenario(0).snapshot(), phase: 'ready' });
  expect(result.hasAttribute('href')).toBe(false);
  expect(new URL(home.href).searchParams.get('text')).toContain('自己ベスト250ラリー');
});

it.each([0, NaN, Infinity, -1, 2.5])('keeps the generic home link available for empty or invalid best %s', bestScore => {
  const { screens, get } = setup();
  screens.setPreferences({ ...DEFAULT_PREFERENCES, bestScore });
  const home = get<HTMLAnchorElement>('[data-share-home-x]');
  expect(home).not.toBeNull();
  expect(new URL(home.href).searchParams.get('text')).toBe('タップ＆ドラッグで遊べる卓球ゲーム「タッケウ」！\n何ラリーつなげられる？ #タッケウ');
});

it.each([NaN, Infinity, -1, 2.5])('disables an unavailable result %s and recovers on a valid final score', score => {
  const { screens, get } = setup();
  const result = get<HTMLAnchorElement>('[data-share-x]');
  screens.render({ ...scenario(12).snapshot(), phase: 'gameover' });
  screens.render({ ...scenario(0).snapshot(), score, phase: 'gameover' });
  expect(result.hasAttribute('href')).toBe(false);
  expect(result.getAttribute('aria-disabled')).toBe('true');
  expect(result.tabIndex).toBe(-1);
  screens.render({ ...scenario(1).snapshot(), phase: 'gameover' });
  expect(new URL(result.href).searchParams.get('text')).toContain('1ラリー達成');
  expect(result.hasAttribute('aria-disabled')).toBe(false);
});

it('preserves the result share through leaderboard and submission failures', () => {
  const { screens, get } = setup();
  screens.render({ ...scenario(0).snapshot(), score: 1234567890, phase: 'gameover' });
  screens.setLeaderboard('error');
  for (const status of ['retryable_failed', 'permanent_failed'] as const) {
    screens.setRankingState({ status, pendingCount: 1 });
    const link = get<HTMLAnchorElement>('[data-share-x]');
    expect(new URL(link.href).searchParams.get('text')).toBe('タッケウで1234567890ラリー達成！\n何ラリーつなげられる？ #タッケウ');
    expect(link.closest('[inert], [hidden]')).toBeNull();
  }
});

it('renders at most 30 players as text with server-provided tie ranks', () => {
  const { root, screens, get } = setup();
  const name = '<img src=x onerror=alert(1)>';
  screens.setLeaderboard('loaded', Array.from({ length: 35 }, (_, i) => ({ rank: i < 2 ? 1 : i + 1, displayName: i === 0 ? name : `名前${i}`, score: 100 - i, playCount: 3 })));
  expect(root.querySelectorAll('[data-ranking-body] tr')).toHaveLength(30);
  expect(get('[data-ranking-body]').textContent).toContain(name);
  expect(get('[data-ranking-body]').querySelector('img')).toBeNull();
  expect([...root.querySelectorAll('[data-ranking-body] tr')].slice(0, 2).map(row => row.firstElementChild?.textContent)).toEqual(['1', '1']);
});

it('exposes empty/error recovery and retry only for transient submission failures', () => {
  const { screens, actions, get } = setup();
  screens.render({ ...scenario(0).snapshot(), phase: 'gameover' });
  screens.setLeaderboard('loaded', []); expect(get('[data-ranking-message]').textContent).toContain('まだ');
  screens.setLeaderboard('error', []); expect(get('[data-ranking-message]').textContent).toContain('取得');
  get('[data-action="ranking-refresh"]').click(); expect(actions.refreshRanking).toHaveBeenCalledTimes(1);
  screens.setRankingState({ status: 'retryable_failed', pendingCount: 1 });
  get('[data-action="ranking-retry"]').click(); expect(actions.retryRanking).toHaveBeenCalledTimes(1);
  screens.setRankingState({ status: 'permanent_failed', pendingCount: 1 });
  expect(get('[data-action="ranking-retry"]').hidden).toBe(true);
  screens.setRankingState({ status: 'submitted', pendingCount: 0 });
  expect(get('[data-ranking-status]').textContent).toContain('記録');
});
