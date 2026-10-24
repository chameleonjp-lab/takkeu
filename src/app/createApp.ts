import { createAudio } from '../audio/audio';
import { DEFAULT_CONFIG, INITIAL_PADDLE } from '../game/config';
import { createSession } from '../game/session';
import type { PauseReason } from '../game/types';
import { createInputTimeline } from '../input/timeline';
import { createView } from '../render/createView';
import type { GameView } from '../render/createView';
import { loadPreferences, savePreferences } from '../storage/preferences';
import type { Preferences, StorageLike } from '../storage/preferences';
import { createScreens } from '../ui/screens';
import { createLoop } from './loop';
import { createControls } from './controls';
import { bindLifecycle } from './lifecycle';
import { createRankingClient } from '../ranking/client';
import type { Play, RankingApi } from '../ranking/client';
import { createRankingController, validateName } from '../ranking/controller';

type AppServices = { createSession: typeof createSession; createView: typeof createView; createAudio: typeof createAudio; storage: StorageLike; rankingApi: RankingApi };
export function createApp(root: HTMLElement, services: Partial<AppServices> = {}) {
  const config = DEFAULT_CONFIG;
  const storage = services.storage ?? { getItem: key => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value) };
  let preferences = loadPreferences(storage);
  const seed = (): number => Date.now() >>> 0;
  const session = (services.createSession ?? createSession)(config, seed());
  const timeline = createInputTimeline(INITIAL_PADDLE);
  const audio = (services.createAudio ?? createAudio)(config, undefined, () => { if (session.snapshot().phase === 'running') pause('hidden'); }, () => {
    if (!disposed) { unlockAttempt++; screens.setAudioReady(preferences.muted); }
  });
  audio.reset(session.snapshot().runId);
  audio.setVolume(preferences.volume); audio.setMuted(preferences.muted);
  let view: GameView | null = null;
  let disposed = false;
  let contextAvailable = true;
  let observedPhase = session.snapshot().phase;
  let unlockAttempt = 0;
  let activePlay: Play | null = null;
  let starting = false, startEpoch = 0, leaderboardEpoch = 0;
  let observedPending = 0;
  const screens = createScreens(root, {
    start, retry: start, pause: () => pause('user'), resume, home,
    toggleSound() { updatePreferences({ muted: !preferences.muted }); if (!preferences.muted) void unlockAudio(); },
    volume(value) { updatePreferences({ volume: value }); void unlockAudio(); },
    retryAudio() { void unlockAudio(); },
    quality(value) { updatePreferences({ quality: value }); resizeView(); },
    retryRanking() { void ranking.retry(); },
    refreshRanking() { void refreshLeaderboard(); },
  });
  const rankingApi = services.rankingApi ?? createRankingClient();
  const ranking = createRankingController(storage, rankingApi, state => {
    if (disposed) return;
    screens.setRankingState(state);
    const recorded = state.pendingCount < observedPending; observedPending = state.pendingCount;
    if ((state.status === 'submitted' || recorded) && session.snapshot().phase === 'gameover') void refreshLeaderboard();
  });
  observedPending = ranking.state().pendingCount;
  screens.setPlayerName(ranking.name()); screens.setRankingState(ranking.state());
  async function refreshLeaderboard(): Promise<void> {
    const epoch = ++leaderboardEpoch;
    screens.setLeaderboard('loading');
    try {
      const rows = await rankingApi.top();
      if (!disposed && epoch === leaderboardEpoch) screens.setLeaderboard('loaded', rows);
    } catch { if (!disposed && epoch === leaderboardEpoch) screens.setLeaderboard('error'); }
  }
  function persist(): void { screens.setStorageAvailable(savePreferences(storage, preferences)); }
  function updatePreferences(update: Partial<Preferences>): void {
    preferences = { ...preferences, ...update };
    audio.setVolume(preferences.volume); audio.setMuted(preferences.muted);
    screens.setSound(preferences.muted); screens.setPreferences(preferences);
    if (preferences.muted) screens.setAudioReady(true);
    view?.setQuality(preferences.quality); persist();
  }
  function rememberBest(): void {
    const score = session.snapshot().score;
    if (score > preferences.bestScore) { preferences = { ...preferences, bestScore: score }; screens.setPreferences(preferences); }
  }
  const loop = createLoop({ session, timeline, config, onEvents: events => audio.consume(events), onPause: pause });
  const swipe = createControls(screens.surface, {
    session, timeline, loop, config,
    mapping: { screen: { left: 0, top: 0, width: 0, height: 0 }, toWorld: () => null },
    onInterruption: () => pause('input-lost'),
    onPauseGesture: () => pause('user'),
  });
  async function unlockAudio(): Promise<void> {
    const attempt = ++unlockAttempt;
    const ready = await audio.unlock();
    if (!disposed && attempt === unlockAttempt) screens.setAudioReady(ready || preferences.muted);
  }
  let fitted = '';
  function resizeView(): void {
    if (!view || !contextAvailable) return;
    const rect = screens.canvasWrap.getBoundingClientRect();
    const key = `${rect.left}:${rect.top}:${rect.width}:${rect.height}:${window.devicePixelRatio}:${preferences.quality}`;
    if (key === fitted) return;
    view.resize(rect.width, rect.height); swipe.updateMapping(view.inputMapping());
    fitted = key;
    view.render(session.snapshot(), []);
  }
  function makeView(): GameView {
    fitted = '';
    const next = (services.createView ?? createView)(screens.canvas, config);
    next.setQuality(preferences.quality); return next;
  }
  function start(): void {
    if (starting) return;
    if (!contextAvailable) { screens.setError('描画の復旧を待つか、再読み込みしてください。'); return; }
    let name: string;
    try { name = validateName(screens.playerName()); }
    catch (error) { screens.setError(error instanceof Error ? error.message : '名前を確認してください。'); return; }
    if (!view) {
      try { view = makeView(); }
      catch (error) { screens.setError(error instanceof Error ? error.message : '描画を開始できません。再読み込みしてください。'); return; }
    }
    screens.setPlayerName(name); screens.setError('');
    void unlockAudio();
    const epoch = ++startEpoch;
    if (!name) { void ranking.start(''); beginRun(null); return; }
    starting = true; screens.setStarting(true);
    void ranking.start(name).then(play => {
      if (disposed || epoch !== startEpoch) return;
      if (contextAvailable) beginRun(play);
      else screens.setError('描画の復旧を待ってから、もう一度開始してください。');
    }).catch(error => {
      if (!disposed && epoch === startEpoch) screens.setError(`${error instanceof Error ? error.message : 'ランキングに接続できません。'} 名前を空欄にするとランキングなしで遊べます。`);
    }).finally(() => {
      if (!disposed && epoch === startEpoch) { starting = false; screens.setStarting(false); screens.setContextAvailable(contextAvailable); }
    });
  }
  function beginRun(play: Play | null): void {
    ranking.finish(activePlay, session.snapshot().score, 'retire');
    activePlay = play; leaderboardEpoch++;
    ranking.clearResult(); screens.setRankingParticipation(!!play);
    rememberBest(); persist();
    swipe.cancel(); session.reset(seed()); session.start();
    timeline.clear(INITIAL_PADDLE); audio.reset(session.snapshot().runId);
    fitted = ''; screens.setError(''); screens.render(session.snapshot()); resizeView();
    loop.resetClock(performance.now()); observedPhase = 'running'; void unlockAudio();
  }
  function silence(): void { unlockAttempt++; audio.suspend(); }
  function pause(reason: PauseReason): void {
    if (session.snapshot().phase === 'paused' && observedPhase === 'paused') return;
    if (session.snapshot().phase === 'running') session.pause(reason);
    if (session.snapshot().phase !== 'paused') return;
    swipe.cancel(); timeline.clear(session.snapshot().paddle); silence(); rememberBest(); persist();
    loop.resetClock(performance.now()); screens.render(session.snapshot());
    if (view && contextAvailable) view.render(session.snapshot(), []);
    observedPhase = 'paused';
  }
  function resume(): void {
    if (session.snapshot().phase !== 'paused' || !contextAvailable || document.hidden) return;
    swipe.cancel(); timeline.clear(session.snapshot().paddle); resizeView();
    session.resume(); loop.resetClock(performance.now()); screens.render(session.snapshot()); void unlockAudio();
  }
  function home(): void {
    startEpoch++; leaderboardEpoch++; starting = false; screens.setStarting(false); screens.setContextAvailable(contextAvailable);
    ranking.finish(activePlay, session.snapshot().score, 'retire'); activePlay = null;
    rememberBest(); persist(); swipe.cancel(); silence(); session.reset(seed());
    timeline.clear(INITIAL_PADDLE); audio.reset(session.snapshot().runId);
    loop.resetClock(performance.now()); screens.render(session.snapshot());
    if(view&&contextAvailable)view.render(session.snapshot(),[]);
  }
  const unbindLifecycle = bindLifecycle({
    canvas: screens.canvas, pause, resize: resizeView,
    contextLost() { contextAvailable = false; screens.setContextAvailable(false); },
    contextRestored() {
      // Let the renderer's own restore listener complete before replacing its resources.
      queueMicrotask(() => {
        if (disposed) return;
        try {
          if (view) { view.dispose(); view = null; view = makeView(); }
          contextAvailable = true; screens.setContextAvailable(true); screens.setError(''); resizeView();
        } catch {
          contextAvailable = false; screens.setContextAvailable(false);
          screens.setError('描画を復旧できませんでした。ホームへ戻るか、再読み込みしてください。');
        }
      });
    },
  });
  screens.setSound(preferences.muted); screens.setPreferences(preferences); persist(); screens.render(session.snapshot());
  void ranking.retry();
  let frameId = 0;
  const frame = (now: number): void => {
    if (disposed) return;
    const result = loop.frame(now); rememberBest();
    if (result.snapshot.phase === 'gameover' && observedPhase !== 'gameover') {
      swipe.cancel(); timeline.clear(result.snapshot.paddle); silence(); persist();
      screens.setRankingParticipation(!!activePlay);
      ranking.finish(activePlay, result.snapshot.score, 'game_over'); activePlay = null;
      void refreshLeaderboard();
    }
    // Frozen scenes need no repeated GPU work. Resize, restore and pause render
    // explicitly; a transition to the result screen may render once.
    const needsFrame = result.snapshot.phase === 'running' || result.snapshot.phase !== observedPhase;
    if (view && contextAvailable && result.snapshot.phase !== 'ready' && needsFrame) view.render(result.snapshot, result.events);
    screens.render(result.snapshot); observedPhase = result.snapshot.phase;
    frameId = requestAnimationFrame(frame);
  };
  frameId = requestAnimationFrame(frame);
  return {
    dispose() {
      if (disposed) return;
      rememberBest(); persist(); disposed = true; unlockAttempt++;
      cancelAnimationFrame(frameId); swipe.dispose(); unbindLifecycle();
      view?.dispose(); void audio.dispose(); screens.dispose();
    },
  };
}
