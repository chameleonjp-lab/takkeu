import { createScreens } from '../../src/ui/screens';
import { createLoadingScreen } from '../../src/ui/loading';
import { getLanguage, initializeLanguage, onLanguageChange, setLanguage } from '../../src/i18n/i18n';
import { DEFAULT_PREFERENCES } from '../../src/storage/preferences';
import type { LoadingState } from '../../src/app/loadingProgress';
import type { ResultPositionState } from '../../src/ranking/resultPosition';
import type { ResultHallState } from '../../src/ranking/resultHall';
import type { RankingState } from '../../src/ranking/controller';
import { scenario } from './scenarios';
import '../../src/ui/styles.css';

// Synthetic states stay in this test fixture. No network client, game loop, GPU
// renderer, score setter, or automation entry point is added to the application.
initializeLanguage(null, { language: 'ja-JP', languages: ['ja-JP'] });
document.documentElement.lang = getLanguage();
const unsubscribe = onLanguageChange(() => { document.documentElement.lang = getLanguage(); });
const root = document.querySelector<HTMLElement>('#app')!;
const mixedName = '<img src=x onerror=alert(1)> ไทย Иван العربية';
const registeredAt = '2026-10-27T23:30:00Z';
const hallEntry = { number: 35, displayName: mixedName, normalizedName: mixedName, registeredAt };
const rankingRows = [
  { rank: 1, displayName: mixedName, score: 3500, playCount: 35 },
  { rank: 1, displayName: 'Player Two', score: 3500, playCount: 10 },
  { rank: 3, displayName: 'Player Three', score: 3000, playCount: 1 },
];
const hallRows = [hallEntry, { number: 36, displayName: 'Player Two', normalizedName: 'Player Two', registeredAt }];
const resultSnapshot = { ...scenario(3500).snapshot(), phase: 'gameover' as const, endReason: 'clear' as const, lostBallCount: 35 };
const actions = { start: 0, pause: 0, resume: 0, retry: 0, home: 0, toggleSound: 0, volume: 0, quality: 0,
  rankingRetry: 0, positionRetry: 0, rankingRefresh: 0, loadingRetry: 0, loadingCancel: 0 };
const screens = createScreens(root, {
  start() { actions.start++; }, pause() { actions.pause++; }, resume() { actions.resume++; },
  retry() { actions.retry++; }, home() { actions.home++; }, toggleSound() { actions.toggleSound++; },
  volume() { actions.volume++; }, quality() { actions.quality++; },
  retryRanking() { actions.rankingRetry++; }, retryPosition() { actions.positionRetry++; }, refreshRanking() { actions.rankingRefresh++; },
});
const pendingLoading: LoadingState = { percent: 35, stage: 'ランキングを確認しています', remainingSeconds: null, elapsedSeconds: 12, error: null };
const loading = createLoadingScreen(root, {
  retry() { actions.loadingRetry++; showLoading(pendingLoading); },
  cancel() { actions.loadingCancel++; showLoading(null); },
});
const initialNodes = {
  shell: root.querySelector('.shell'), canvas: screens.canvas, surface: screens.surface,
  name: root.querySelector('[data-player-name]'), result: root.querySelector('[data-result]'),
  retry: root.querySelector('[data-result] [data-action="retry"]'),
};

function showLoading(state: LoadingState | null): void {
  screens.setPreparing(state !== null); screens.setStarting(state !== null); loading.show(state);
}

function showResult(): void {
  showLoading(null);
  screens.setPreferences({ ...DEFAULT_PREFERENCES, bestScore: 3500, volume: 0.3 });
  screens.setPlayerName(mixedName); screens.setAudioReady(true); screens.setStorageAvailable(true); screens.setError('');
  screens.setRankingParticipation(true); screens.setRankingState({ status: 'submitted', pendingCount: 0 });
  screens.render(resultSnapshot);
  screens.setLeaderboard('loaded', rankingRows); screens.setHallOfFame('loaded', hallRows);
  screens.setResultPosition({ status: 'loaded', rank: 35, total: 1250, bestScore: 3500 });
  screens.setResultHall({ status: 'registered', hall: hallEntry });
}

const i18nHarness = {
  result: showResult,
  language: setLanguage,
  leaderboard(state: 'loading' | 'loaded' | 'error', empty = false) { screens.setLeaderboard(state, empty ? [] : rankingRows); },
  hallList(state: 'loading' | 'loaded' | 'error', empty = false) { screens.setHallOfFame(state, empty ? [] : hallRows); },
  position(status: ResultPositionState['status']) {
    screens.setResultPosition(status === 'loaded' ? { status, rank: 35, total: 1250, bestScore: 3500 } : { status });
  },
  hall(status: ResultHallState['status']) {
    screens.setResultHall(status === 'registered' ? { status, hall: hallEntry } : { status, displayName: mixedName });
  },
  submission(status: RankingState['status']) { screens.setRankingState({ status, pendingCount: status === 'submitted' || status === 'idle' ? 0 : 1 }); },
  error: screens.setError,
  loading: showLoading,
  fontScale(scale: 100 | 200) { document.documentElement.style.fontSize = `${scale}%`; window.scrollTo(0, 0); },
  state() {
    return {
      language: getLanguage(), snapshot: resultSnapshot, actions: { ...actions },
      sameNodes: initialNodes.shell === root.querySelector('.shell') && initialNodes.canvas === root.querySelector('canvas')
        && initialNodes.surface === root.querySelector('[data-testid="input-surface"]') && initialNodes.name === root.querySelector('[data-player-name]')
        && initialNodes.result === root.querySelector('[data-result]') && initialNodes.retry === root.querySelector('[data-result] [data-action="retry"]'),
    };
  },
  dispose() { loading.dispose(); screens.dispose(); unsubscribe(); },
};
declare global { interface Window { i18nHarness: typeof i18nHarness } }
window.i18nHarness = i18nHarness;
showResult();
