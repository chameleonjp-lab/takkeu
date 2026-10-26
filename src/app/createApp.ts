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
import { createResultPosition } from '../ranking/resultPosition';
import { createFinishPresentation } from './finishPresentation';
import type { InputMapping } from '../input/mapping';
import { createLoadingScreen } from '../ui/loading';
import { createLoadingProgress,nextPaint,waitForPreparation } from './loadingProgress';

type AppServices = { createSession: typeof createSession; createView: typeof createView; createAudio: typeof createAudio; storage: StorageLike; rankingApi: RankingApi };
export function createApp(root: HTMLElement, services: Partial<AppServices> = {}) {
  const config = DEFAULT_CONFIG;
  const storage = services.storage ?? {
    getItem: key => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value),
    removeItem: (key: string) => window.localStorage.removeItem(key), key: (index: number) => window.localStorage.key(index),
    get length() { return window.localStorage.length; },
  };
  let preferences = loadPreferences(storage);
  const seed = (): number => Date.now() >>> 0;
  const session = (services.createSession ?? createSession)(config, seed());
  const timeline = createInputTimeline(INITIAL_PADDLE);
  const audio = (services.createAudio ?? createAudio)(config, undefined, () => { if (session.snapshot().phase === 'running') pause('hidden'); }, () => {
    if (!disposed) { unlockAttempt++; screens.setAudioReady(preferences.muted); }
  });
  audio.reset(session.snapshot().runId);
  audio.setVolume(preferences.volume); audio.setMuted(preferences.muted); audio.setQuality?.(preferences.quality);
  let view: GameView | null = null;
  let disposed = false;
  let contextAvailable = true;
  let observedPhase = session.snapshot().phase;
  const finishPresentation = createFinishPresentation();
  let wasFinishing = false;
  let unlockAttempt = 0;
  let activePlay: Play | null = null;
  let nextProgressReportAt = 0, progressReportInFlight = false;
  let starting = false, startEpoch = 0, leaderboardEpoch = 0;
  let pendingStart:AbortController|null=null,viewPrepared=false;
  let preparingPlay:Play|null=null;
  let loadingProgress:ReturnType<typeof createLoadingProgress>|null=null,loadingError:string|null=null;
  let loadingShowAt=0;
  let observedPending = 0;
  const screens = createScreens(root, {
    start, retry: start, pause: () => pause('user'), resume, home,
    toggleSound() { updatePreferences({ muted: !preferences.muted }); if (!preferences.muted) void unlockAudio(); },
    volume(value) { updatePreferences({ volume: value }); void unlockAudio(); },
    retryAudio() { void unlockAudio(); },
    quality(value) { updatePreferences({ quality: value }); resizeView(); },
    retryRanking() { void ranking.retry(); },
    refreshRanking() { void refreshLeaderboard(); void resultPosition.retry(); },
    retryPosition() { void ranking.retry().then(() => { if (!disposed && resultPosition.state().status === 'error') void resultPosition.retry(); }); },
  });
  const loadingScreen=createLoadingScreen(root,{cancel:home,retry:start});
  const rankingApi = services.rankingApi ?? createRankingClient();
  const ranking = createRankingController(storage, rankingApi, state => {
    if (disposed) return;
    screens.setRankingState(state);
    const recorded = state.pendingCount < observedPending; observedPending = state.pendingCount;
    if ((state.status === 'submitted' || recorded) && session.snapshot().phase === 'gameover') void refreshLeaderboard();
  }, event => { if (!disposed) void resultPosition.submission(event); });
  const resultPosition = createResultPosition(rankingApi, state => { if (!disposed) screens.setResultPosition(state); });
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
    audio.setVolume(preferences.volume); audio.setMuted(preferences.muted); audio.setQuality?.(preferences.quality);
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
  // A viewport can change between animation frames, including during a held
  // drag. Refit in capture phase before the swipe controller validates input.
  const refreshInputLayout=():void=>{
    if(!starting&&!loadingError&&session.snapshot().phase==='running'&&inputMapping?.isCurrent?.()===false)resizeView();
  };
  const pointerEvents=['pointerdown','pointermove','pointerup'] as const;
  for(const event of pointerEvents)root.ownerDocument.addEventListener(event,refreshInputLayout,{capture:true,passive:true});
  async function unlockAudio(): Promise<void> {
    const attempt = ++unlockAttempt;
    const ready = await audio.unlock();
    if (!disposed && attempt === unlockAttempt) screens.setAudioReady(ready || preferences.muted);
  }
  let fitted = '';
  let inputMapping: InputMapping | null = null;
  function resizeView(): void {
    if (!view || !contextAvailable) return;
    const rect = screens.canvasWrap.getBoundingClientRect();
    const key = `${rect.left}:${rect.top}:${rect.width}:${rect.height}:${window.devicePixelRatio}:${preferences.quality}`;
    if (rect.width <= 0 || rect.height <= 0) return;
    if (key === fitted && inputMapping?.isCurrent?.() !== false) return;
    view.resize(rect.width, rect.height);
    // Benign mobile chrome changes keep the held pointer. Real interruptions
    // pause/cancel before refitting, so stale contacts still cannot resume play.
    inputMapping = view.inputMapping();
    swipe.updateMapping(inputMapping, session.snapshot().phase === 'running');
    fitted = key;
    if(!starting&&!loadingError)view.render(finishPresentation.frame(session.snapshot(), performance.now()).snapshot, []);
  }
  function makeView(): GameView {
    fitted = '';inputMapping=null;viewPrepared=false;
    const next = (services.createView ?? createView)(screens.canvas, config);
    next.setQuality(preferences.quality); return next;
  }
  function start(): void {
    if (starting) return;
    if (!contextAvailable) { showLoadingError('描画の復旧を待ってから、もう一度準備してください。'); return; }
    let name: string;
    try { name = validateName(screens.playerName()); }
    catch (error) { screens.setError(error instanceof Error ? error.message : '名前を確認してください。'); return; }
    screens.setPlayerName(name); screens.setError('');
    const epoch = ++startEpoch;
    pendingStart?.abort();const controller=new AbortController();pendingStart=controller;
    resultPosition.clear();
    starting=true;loadingError=null;loadingProgress=createLoadingProgress();
    // Cached starts need no display frames. Only show their instructions if
    // audio, ranking or input readiness actually keeps the player waiting.
    loadingShowAt=viewPrepared?performance.now()+150:0;
    screens.setStarting(true);screens.setPreparing(true);
    loadingScreen.show(viewPrepared?null:loadingProgress.state());
    // Start browser audio permission work inside the user's click. It must not
    // hold gameplay hostage when a browser refuses or never finishes resuming.
    unlockAttempt++;
    const sound=waitForPreparation(audio.prepare?.()??audio.unlock(),2000,controller.signal).catch(()=>false);
    void prepareStart(name,epoch,controller,sound);
  }
  function showLoadingError(message:string):void{
    loadingError=message;loadingProgress??=createLoadingProgress();
    screens.setPreparing(true);loadingScreen.show(loadingProgress.state(message));
  }
  function retirePreparingPlay():void{
    const play=preparingPlay;preparingPlay=null;if(play)ranking.finish(play,0,'retire',0);
  }
  async function prepareStart(name:string,epoch:number,controller:AbortController,sound:Promise<boolean>):Promise<void>{
    const {signal}=controller,current=()=>!disposed&&epoch===startEpoch&&!signal.aborted;
    const progress=loadingProgress!;
    const reuseCourt=viewPrepared;
    let preparingCourt=false;
    try{
      if(!reuseCourt)await nextPaint(signal);
      if(!current())return;
      if(!view)view=makeView();
      resizeView();preparingCourt=true;
      if(!viewPrepared)await waitForPreparation(view.prepare?.((n,total)=>{
        if(current())progress.report('court',total>0?n/total:0);
      })??Promise.resolve(),20000,signal);
      if(!current())return;
      viewPrepared=true;preparingCourt=false;progress.report('court',1);
      progress.report('sound',0);const soundReady=await sound;if(!current())return;
      screens.setAudioReady(soundReady||preferences.muted);progress.report('sound',1);
      progress.report('ranking',0);
      let play:Play|null=null;
      if(name){
        const registered=ranking.start(name).then(accepted=>{if(!current())ranking.finish(accepted,0,'retire',0);return accepted;});
        play=await waitForPreparation(registered,12000,signal);
        if(current())preparingPlay=play;
      }else void ranking.start('');
      if(!current())return;progress.report('ranking',1);progress.report('controls',0);
      await waitForPreparation(fitStartingInput(signal,reuseCourt),5000,signal);
      if(!current()||!contextAvailable||document.hidden){retirePreparingPlay();throw new Error('画面に戻ってから、もう一度準備してください。');}
      progress.report('controls',1);progress.finish();
      preparingPlay=null;pendingStart=null;starting=false;loadingProgress=null;loadingScreen.show(null);
      screens.setStarting(false);screens.setPreparing(false);screens.setContextAvailable(contextAvailable);
      beginRun(play);
    }catch(error){
      if(!current())return;
      controller.abort();ranking.abandonStart();retirePreparingPlay();
      if(preparingCourt&&view){view.dispose();view=null;viewPrepared=false;fitted='';inputMapping=null;}
      pendingStart=null;starting=false;screens.setStarting(false);silence();
      showLoadingError(error instanceof Error?error.message:'準備を完了できませんでした。もう一度お試しください。');
    }
  }
  function startingInputReady():boolean{
    const bounds=screens.canvasWrap.getBoundingClientRect();
    const mapping=inputMapping,rect=mapping?.screen;
    return !!(bounds.width>0&&bounds.height>0&&rect&&rect.width>0&&rect.height>0&&mapping.isCurrent?.()!==false
      &&mapping.toWorld(rect.left+rect.width/2,rect.top+rect.height/2));
  }
  async function fitStartingInput(signal:AbortSignal,reuseCourt:boolean):Promise<void>{
    if(reuseCourt){resizeView();if(startingInputReady())return;}
    let stable='';
    for(;;){
      await nextPaint(signal);resizeView();
      if(document.hidden||!contextAvailable)throw new Error('画面に戻ってから、もう一度準備してください。');
      if(startingInputReady()){
        if(stable===fitted)return;stable=fitted;
      }else stable='';
    }
  }
  function beginRun(play: Play | null): void {
    ranking.finish(activePlay, session.snapshot().score, 'retire', session.snapshot().lostBallCount);
    activePlay = play; leaderboardEpoch++;
    nextProgressReportAt = performance.now() + 15000; progressReportInFlight = false;
    ranking.clearResult(); screens.setRankingParticipation(!!play);
    rememberBest(); persist();
    swipe.cancel(); session.reset(seed()); session.start();
    timeline.clear(INITIAL_PADDLE); audio.reset(session.snapshot().runId);
    fitted = ''; screens.setError(''); screens.render(session.snapshot()); resizeView();
    loop.resetClock(performance.now()); observedPhase = 'running';
  }
  function silence(): void { unlockAttempt++; audio.suspend(); }
  function pause(reason: PauseReason): void {
    if(starting){
      if(reason==='resize'){resizeView();return;}
      startEpoch++;pendingStart?.abort();pendingStart=null;ranking.abandonStart();retirePreparingPlay();starting=false;screens.setStarting(false);silence();
      showLoadingError(reason==='context-lost'?'描画の復旧を待ってから、もう一度準備してください。':'画面を離れたため準備を中断しました。もう一度準備してください。');return;
    }
    if (session.snapshot().phase === 'gameover') { silence(); return; }
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
    resultPosition.clear();
    if(starting)ranking.abandonStart();pendingStart?.abort();pendingStart=null;retirePreparingPlay();loadingProgress=null;loadingError=null;loadingScreen.show(null);screens.setPreparing(false);
    startEpoch++; leaderboardEpoch++; starting = false; screens.setStarting(false); screens.setContextAvailable(contextAvailable);
    ranking.finish(activePlay, session.snapshot().score, 'retire', session.snapshot().lostBallCount); activePlay = null;
    rememberBest(); persist(); swipe.cancel(); silence(); session.reset(seed());
    timeline.clear(INITIAL_PADDLE); audio.reset(session.snapshot().runId);
    loop.resetClock(performance.now()); screens.render(session.snapshot());
    if(view&&contextAvailable)view.render(session.snapshot(),[]);
  }
  const unbindLifecycle = bindLifecycle({
    canvas: screens.canvas, pause, resize: resizeView,
    contextLost() { contextAvailable = false;viewPrepared=false;inputMapping=null;screens.setContextAvailable(false); },
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
  const retryOnline = () => {
    // The connection can recover before an old request reports its failure.
    // Retry again after that in-flight attempt settles so the event is not lost.
    void ranking.retry().then(() => { if (!disposed) void ranking.retry(); });
  };
  window.addEventListener('online', retryOnline);
  let frameId = 0;
  const frame = (now: number): void => {
    if (disposed) return;
    if(starting&&loadingProgress&&now>=loadingShowAt)loadingScreen.show(loadingProgress.state());
    // Dynamic viewport/layout changes can resize the court without a window
    // resize event. Refresh its camera mapping before accepting the next frame.
    if (session.snapshot().phase === 'running') resizeView();
    const result = loop.frame(now); rememberBest();
    // Best-effort high-score snapshots for later reviews; never delay the game or rank submission.
    if (activePlay && result.snapshot.phase === 'running' && now >= nextProgressReportAt) {
      nextProgressReportAt = now + 15000;
      if (result.snapshot.score >= 100 && !progressReportInFlight && rankingApi.progress) {
        const play = activePlay;
        progressReportInFlight = true;
        void rankingApi.progress(play, {
          score: result.snapshot.score, simSeconds: result.snapshot.simTime,
          ballCount: result.snapshot.balls.length, lostBalls: result.snapshot.lostBallCount,
        }).catch(() => { /* Offline snapshots never block play. */ })
          .finally(() => { progressReportInFlight = false; });
      }
    }
    const presentation = finishPresentation.frame(result.snapshot, now);
    if (result.snapshot.phase === 'gameover' && observedPhase !== 'gameover') {
      swipe.cancel(); timeline.clear(result.snapshot.paddle); persist();
      if (!presentation.finishing) silence();
      screens.setRankingParticipation(!!activePlay);
      resultPosition.show(activePlay);
      ranking.finish(activePlay, result.snapshot.score, 'game_over', result.snapshot.lostBallCount); activePlay = null;
      void refreshLeaderboard();
    }
    // Continue the last celebration without advancing gameplay. Once it ends,
    // frozen scenes only draw on explicit resize/restore or screen changes.
    const needsFrame = result.snapshot.phase === 'running' || result.snapshot.phase !== observedPhase || presentation.finishing || wasFinishing;
    if (view && contextAvailable && !starting && !loadingError && result.snapshot.phase !== 'ready' && needsFrame) view.render(presentation.snapshot, result.events);
    if (wasFinishing && !presentation.finishing) silence();
    screens.render(result.snapshot, presentation.finishing); observedPhase = result.snapshot.phase; wasFinishing = presentation.finishing;
    frameId = requestAnimationFrame(frame);
  };
  frameId = requestAnimationFrame(frame);
  return {
    dispose() {
      if (disposed) return;
      rememberBest(); persist(); disposed = true; unlockAttempt++;
      if(starting)ranking.abandonStart();pendingStart?.abort();pendingStart=null;retirePreparingPlay();loadingScreen.dispose();
      resultPosition.dispose();
      cancelAnimationFrame(frameId); swipe.dispose(); unbindLifecycle();
      for(const event of pointerEvents)root.ownerDocument.removeEventListener(event,refreshInputLayout,true);
      window.removeEventListener('online', retryOnline);
      view?.dispose(); void audio.dispose(); screens.dispose();
    },
  };
}
