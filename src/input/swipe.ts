import type { InputSample, PaddlePoint } from '../game/types';
export type InputMapping = Readonly<{ screen: { left: number; top: number; width: number; height: number }; world: { minX: number; maxX: number; minY: number; maxY: number } }>;
export type SwipeOptions = { mapping: InputMapping; sensitivity?(): number; onTarget(sample: InputSample): void; getPaddlePosition(): PaddlePoint; toSimTime(eventTimestamp: number): number; onInterruption(): void; canStart?(): boolean; beforeInput?(eventTimestamp: number): void; onHold?(sample: InputSample): void };
export interface SwipeController { updateMapping(mapping: InputMapping): void; cancel(): void; dispose(): void }
export function createSwipeController(element: HTMLElement, options: SwipeOptions): SwipeController {
  const doc = element.ownerDocument;
  let mapping = options.mapping;
  let active: { id: number; x: number; y: number; paddle: PaddlePoint } | null = null;
  const notify = (target: PaddlePoint, timestamp: number): void => options.onTarget({ target, at: options.toSimTime(timestamp) });
  const finish = (timestamp: number): void => {
    const id = active?.id;
    active = null; // A normal lostpointercapture following release is not an interruption.
    const sample = { target: options.getPaddlePosition(), at: options.toSimTime(timestamp) };
    (options.onHold ?? options.onTarget)(sample);
    if (id !== undefined && element.hasPointerCapture?.(id)) {
      try { element.releasePointerCapture(id); } catch { /* Document listeners still release input. */ }
    }
  };
  const down = (event: PointerEvent): void => {
    if (active || event.button !== 0 || options.canStart?.() === false) return;
    if (event.target instanceof Element && event.target.closest('button, input, select, textarea, a, summary')) return;
    options.beforeInput?.(event.timeStamp);
    if (options.canStart?.() === false) return;
    active = { id: event.pointerId, x: event.clientX, y: event.clientY, paddle: { ...options.getPaddlePosition() } };
    notify(active.paddle, event.timeStamp);
    try { element.setPointerCapture(event.pointerId); } catch { /* Track through document when capture is unavailable. */ }
    event.preventDefault();
  };
  const move = (event: PointerEvent): void => {
    if (!active || active.id !== event.pointerId) return;
    options.beforeInput?.(event.timeStamp);
    if (!active || options.canStart?.() === false) return;
    const { screen, world } = mapping;
    const sensitivity = options.sensitivity?.() ?? 1;
    const x = active.paddle.x + (event.clientX - active.x) * sensitivity * (world.maxX - world.minX) / Math.max(1, screen.width);
    const y = active.paddle.y - (event.clientY - active.y) * sensitivity * (world.maxY - world.minY) / Math.max(1, screen.height);
    notify({ x: Math.min(world.maxX, Math.max(world.minX, x)), y: Math.min(world.maxY, Math.max(world.minY, y)) }, event.timeStamp);
    event.preventDefault();
  };
  const up = (event: PointerEvent): void => {
    if (active?.id !== event.pointerId) return;
    options.beforeInput?.(event.timeStamp);
    if (active?.id === event.pointerId) finish(event.timeStamp);
  };
  const interrupted = (event: PointerEvent): void => {
    if (active?.id !== event.pointerId) return;
    options.beforeInput?.(event.timeStamp);
    if (active?.id !== event.pointerId) return;
    finish(event.timeStamp);
    options.onInterruption();
  };
  element.addEventListener('pointerdown', down);
  doc.addEventListener('pointermove', move, { passive: false });
  doc.addEventListener('pointerup', up);
  doc.addEventListener('pointercancel', interrupted);
  element.addEventListener('lostpointercapture', interrupted);
  const contextMenu = (event: Event): void => event.preventDefault();
  element.addEventListener('contextmenu', contextMenu);
  return {
    updateMapping(next) { if (active) finish(performance.now()); mapping = next; },
    cancel() { if (active) finish(performance.now()); },
    dispose() {
      if (active) finish(performance.now());
      element.removeEventListener('pointerdown', down);
      doc.removeEventListener('pointermove', move);
      doc.removeEventListener('pointerup', up);
      doc.removeEventListener('pointercancel', interrupted);
      element.removeEventListener('lostpointercapture', interrupted);
      element.removeEventListener('contextmenu', contextMenu);
    },
  };
}
