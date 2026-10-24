import type { PauseReason } from '../game/types';

type LifecycleApp = { canvas: HTMLCanvasElement; pause(reason: PauseReason): void; resize(): void; contextLost(): void; contextRestored(): void };
/** One binding for an application's lifetime. Returning to a screen never rebinds it. */
export function bindLifecycle(app: LifecycleApp): () => void {
  const doc = app.canvas.ownerDocument, win = doc.defaultView!;
  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  let width = win.innerWidth, height = win.innerHeight, pixelRatio = win.devicePixelRatio;
  const angle = () => win.screen.orientation?.angle ?? win.orientation ?? 0;
  let orientation = angle();
  const settle = (): void => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { resizeTimer = undefined; app.resize(); }, 100);
  };
  const resize = (): void => {
    const nextWidth = win.innerWidth, nextHeight = win.innerHeight, nextRatio = win.devicePixelRatio;
    if (width === nextWidth && height === nextHeight && pixelRatio === nextRatio) return;
    // Dismissing the name keyboard/focusing the game can resize Safari's chrome.
    // Refit height-only mobile changes without interrupting a newly started run.
    const chromeOnly = width === nextWidth && pixelRatio === nextRatio && win.matchMedia?.('(pointer: coarse)').matches;
    width = nextWidth; height = nextHeight; pixelRatio = nextRatio;
    if (chromeOnly) app.resize();
    else app.pause('resize');
    settle();
  };
  const rotate = (): void => {
    const next = angle();
    if (next === orientation) return;
    orientation = next;
    width = win.innerWidth; height = win.innerHeight; pixelRatio = win.devicePixelRatio;
    app.pause('resize'); settle();
  };
  const hidden = (): void => { if (doc.hidden) app.pause('hidden'); };
  const leave = (): void => app.pause('hidden');
  const lost = (event: Event): void => { event.preventDefault(); app.contextLost(); app.pause('context-lost'); };
  const restored = (): void => app.contextRestored();
  win.addEventListener('resize', resize); win.addEventListener('orientationchange', rotate);
  win.addEventListener('blur', leave); win.addEventListener('pagehide', leave);
  doc.addEventListener('visibilitychange', hidden); doc.addEventListener('freeze', leave);
  app.canvas.addEventListener('webglcontextlost', lost); app.canvas.addEventListener('webglcontextrestored', restored);
  return () => {
    clearTimeout(resizeTimer);
    win.removeEventListener('resize', resize); win.removeEventListener('orientationchange', rotate);
    win.removeEventListener('blur', leave); win.removeEventListener('pagehide', leave);
    doc.removeEventListener('visibilitychange', hidden); doc.removeEventListener('freeze', leave);
    app.canvas.removeEventListener('webglcontextlost', lost); app.canvas.removeEventListener('webglcontextrestored', restored);
  };
}
