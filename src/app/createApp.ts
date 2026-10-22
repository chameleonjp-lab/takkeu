import { createAudio } from '../audio/audio';
import { DEFAULT_CONFIG, INITIAL_PADDLE } from '../game/config';
import { createSession } from '../game/session';
import type { PauseReason } from '../game/types';
import { createInputTimeline } from '../input/timeline';
import { createView } from '../render/createView';
import type { GameView } from '../render/createView';
import { createScreens } from '../ui/screens';
import { createLoop } from './loop';
import { createControls } from './controls';

export function createApp(root: HTMLElement) {
  const config = DEFAULT_CONFIG;
  const seed = (): number => Date.now() >>> 0;
  const session = createSession(config, seed());
  const timeline = createInputTimeline(INITIAL_PADDLE);
  const audio = createAudio(config);
  audio.reset(session.snapshot().runId);
  let view: GameView | null = null;
  let muted = false;
  let disposed = false;
  let contextAvailable = true;
  let observedPhase = session.snapshot().phase;
  const screens = createScreens(root, {
    start, retry: start, pause: () => pause('user'), resume, home,
    toggleSound() { muted = !muted; audio.setMuted(muted); screens.setSound(muted); if (!muted) void unlockAudio(); },
    volume(value) { audio.setVolume(value); void unlockAudio(); },
  });
  const loop = createLoop({ session, timeline, config, onEvents: events => audio.consume(events), onPause: pause });
  const swipe = createControls(screens.surface, {
    session, timeline, loop, config,
    mapping: { screen: { left: 0, top: 0, width: 1, height: 1 }, world: { minX: config.paddleMinX, maxX: config.paddleMaxX, minY: config.paddleMinY, maxY: config.paddleMaxY } },
    onInterruption: () => pause('input-lost'),
  });
  async function unlockAudio(): Promise<void> {
    const ready = await audio.unlock();
    if (!disposed) screens.setAudioReady(ready || muted);
  }
  function resizeView(): void {
    if (!view) return;
    const rect = screens.canvasWrap.getBoundingClientRect();
    view.resize(rect.width, rect.height);
    swipe.updateMapping(view.inputMapping());
    if (contextAvailable) view.render(session.snapshot(), []);
  }
  function start(): void {
    if (!view) {
      try { view = createView(screens.canvas, config); }
      catch (error) { screens.setError(error instanceof Error ? error.message : '描画を開始できません。再読み込みしてください。'); return; }
    }
    swipe.cancel(); session.reset(seed()); session.start();
    timeline.clear(INITIAL_PADDLE); audio.reset(session.snapshot().runId);
    screens.setError(''); screens.render(session.snapshot()); resizeView();
    loop.resetClock(performance.now()); observedPhase = 'running';
    void unlockAudio();
  }
  function pause(reason: PauseReason): void {
    if (session.snapshot().phase === 'running') session.pause(reason);
    if (session.snapshot().phase !== 'paused') return;
    swipe.cancel(); timeline.clear(session.snapshot().paddle); audio.suspend();
    loop.resetClock(performance.now()); screens.render(session.snapshot());
  }
  function resume(): void {
    if (session.snapshot().phase !== 'paused' || !contextAvailable) return;
    swipe.cancel(); timeline.clear(session.snapshot().paddle); resizeView();
    session.resume(); loop.resetClock(performance.now());
    screens.render(session.snapshot()); void unlockAudio();
  }
  function home(): void {
    swipe.cancel(); audio.suspend(); session.reset(seed());
    timeline.clear(INITIAL_PADDLE); audio.reset(session.snapshot().runId);
    loop.resetClock(performance.now()); screens.render(session.snapshot());
  }
  const onResize = (): void => { pause('resize'); resizeView(); };
  const onHidden = (): void => { if (document.hidden) pause('hidden'); };
  const onBlur = (): void => pause('hidden');
  const onContextLost = (event: Event): void => { event.preventDefault(); contextAvailable = false; pause('context-lost'); };
  const onContextRestored = (): void => { contextAvailable = true; resizeView(); };
  window.addEventListener('resize', onResize);
  window.addEventListener('blur', onBlur);
  window.addEventListener('pagehide', onBlur);
  document.addEventListener('visibilitychange', onHidden);
  screens.canvas.addEventListener('webglcontextlost', onContextLost);
  screens.canvas.addEventListener('webglcontextrestored', onContextRestored);
  screens.render(session.snapshot());
  let frameId = 0;
  const frame = (now: number): void => {
    if (disposed) return;
    const result = loop.frame(now);
    if (result.snapshot.phase === 'gameover' && observedPhase !== 'gameover') {
      swipe.cancel(); timeline.clear(result.snapshot.paddle); audio.suspend();
    }
    if (view && contextAvailable && result.snapshot.phase !== 'ready') view.render(result.snapshot, result.events);
    screens.render(result.snapshot); observedPhase = result.snapshot.phase;
    frameId = requestAnimationFrame(frame);
  };
  frameId = requestAnimationFrame(frame);
  return {
    dispose() {
      disposed = true; cancelAnimationFrame(frameId); swipe.dispose();
      window.removeEventListener('resize', onResize); window.removeEventListener('blur', onBlur); window.removeEventListener('pagehide', onBlur);
      document.removeEventListener('visibilitychange', onHidden);
      screens.canvas.removeEventListener('webglcontextlost', onContextLost); screens.canvas.removeEventListener('webglcontextrestored', onContextRestored);
      view?.dispose(); void audio.dispose(); screens.dispose();
    },
  };
}
