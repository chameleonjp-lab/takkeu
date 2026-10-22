import type { PauseReason } from '../game/types';

type LifecycleApp = { canvas: HTMLCanvasElement; pause(reason: PauseReason): void; resize(): void; contextLost(): void; contextRestored(): void };
/** One binding for an application's lifetime. Returning to a screen never rebinds it. */
export function bindLifecycle(app: LifecycleApp): () => void {
  const doc = app.canvas.ownerDocument, win = doc.defaultView!;
  const resize = (): void => { app.pause('resize'); app.resize(); };
  const hidden = (): void => { if (doc.hidden) app.pause('hidden'); };
  const leave = (): void => app.pause('hidden');
  const lost = (event: Event): void => { event.preventDefault(); app.contextLost(); app.pause('context-lost'); };
  const restored = (): void => app.contextRestored();
  win.addEventListener('resize', resize); win.addEventListener('orientationchange', resize);
  win.addEventListener('blur', leave); win.addEventListener('pagehide', leave);
  doc.addEventListener('visibilitychange', hidden); doc.addEventListener('freeze', leave);
  app.canvas.addEventListener('webglcontextlost', lost); app.canvas.addEventListener('webglcontextrestored', restored);
  return () => {
    win.removeEventListener('resize', resize); win.removeEventListener('orientationchange', resize);
    win.removeEventListener('blur', leave); win.removeEventListener('pagehide', leave);
    doc.removeEventListener('visibilitychange', hidden); doc.removeEventListener('freeze', leave);
    app.canvas.removeEventListener('webglcontextlost', lost); app.canvas.removeEventListener('webglcontextrestored', restored);
  };
}
